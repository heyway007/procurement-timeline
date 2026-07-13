import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

interface Env {
  ASSETS: AssetFetcher;
  STORAGE_MODE?: string;
  GOOGLE_DRIVE_CLIENT_EMAIL?: string;
  GOOGLE_DRIVE_PRIVATE_KEY?: string;
  GOOGLE_DRIVE_PRIVATE_KEY_BASE64?: string;
  GOOGLE_DRIVE_FILE_ID?: string;
  GOOGLE_DRIVE_FOLDER_ID?: string;
  GOOGLE_DRIVE_FILE_NAME?: string;
  HOLIDAY_PREVIEW_SECRET?: string;
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

const RUNTIME_ENV_KEYS = [
  "STORAGE_MODE",
  "GOOGLE_DRIVE_CLIENT_EMAIL",
  "GOOGLE_DRIVE_PRIVATE_KEY",
  "GOOGLE_DRIVE_PRIVATE_KEY_BASE64",
  "GOOGLE_DRIVE_FILE_ID",
  "GOOGLE_DRIVE_FOLDER_ID",
  "GOOGLE_DRIVE_FILE_NAME",
  "HOLIDAY_PREVIEW_SECRET",
] as const;

function syncRuntimeEnv(env: Env): void {
  if (typeof process === "undefined" || !process.env) return;
  for (const key of RUNTIME_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string") process.env[key] = value;
  }
}

const worker = {
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

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
