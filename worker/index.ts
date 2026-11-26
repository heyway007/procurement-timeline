import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  syncRuntimeEnv,
  type RuntimeEnvBindings,
} from "./runtime-env";
import { createPrismaClient, runWithPrisma } from "../lib/db/prisma";
import { getHolidaySyncCoordinator } from "../lib/holidays/container";
import { storageModeFromEnv } from "../lib/storage/config";

type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

interface Env extends RuntimeEnvBindings {
  ASSETS: AssetFetcher;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  scheduled(
    _controller: { scheduledTime: number },
    env: Env,
    ctx: ExecutionContext,
  ): void {
    syncRuntimeEnv(env);
    const refresh = async () => (await getHolidaySyncCoordinator()).syncUpcomingYears();
    if (storageModeFromEnv(process.env) === "google_drive") {
      ctx.waitUntil(refresh());
      return;
    }
    const prisma = createPrismaClient(env.DATABASE_URL, { useSupabaseTransactionPooler: true });
    ctx.waitUntil(runWithPrisma(prisma, async () => {
      try {
        return await refresh();
      } finally {
        await prisma.$disconnect();
      }
    }));
  },

  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    syncRuntimeEnv(env);
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image" && env.IMAGES) {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES!.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    }

    if (!url.pathname.startsWith("/api/")) {
      return handler.fetch(request, env, ctx);
    }

    const prisma = createPrismaClient(env.DATABASE_URL, {
      useSupabaseTransactionPooler: true,
    });
    return runWithPrisma(prisma, async () => {
      try {
        return await handler.fetch(request, env, ctx);
      } finally {
        ctx.waitUntil(prisma.$disconnect());
      }
    });
  },
};

export default worker;
