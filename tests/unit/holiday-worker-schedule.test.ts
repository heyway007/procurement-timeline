// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ sync: vi.fn(), disconnect: vi.fn(), create: vi.fn(), scoped: vi.fn() }));
vi.mock("vinext/server/app-router-entry", () => ({ default: { fetch: vi.fn() } }));
vi.mock("vinext/server/image-optimization", () => ({ DEFAULT_DEVICE_SIZES: [], DEFAULT_IMAGE_SIZES: [], handleImageOptimization: vi.fn() }));
vi.mock("@/lib/holidays/container", () => ({ getHolidaySyncCoordinator: async () => ({ syncUpcomingYears: state.sync }) }));
vi.mock("@/lib/db/prisma", () => ({
  createPrismaClient: state.create,
  runWithPrisma: state.scoped,
}));
import worker from "@/worker/index";

describe("daily official holiday checks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.disconnect.mockResolvedValue(undefined);
    state.create.mockReturnValue({ $disconnect: state.disconnect });
    state.scoped.mockImplementation(async (_client, callback) => callback());
    state.sync.mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([false, true])("runs with bound PostgreSQL configuration and disconnects (source fails: %s)", async (fails) => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("STORAGE_MODE", "");
    if (fails) state.sync.mockRejectedValue(new Error("database unavailable"));
    const pending: Promise<unknown>[] = [];
    worker.scheduled({ scheduledTime: Date.parse("2026-11-26T00:00:00.000Z") }, {
      ASSETS: { fetch: async () => new Response() },
      STORAGE_MODE: "postgres", DATABASE_URL: "postgresql://test.example/timeline",
    }, { waitUntil: (promise) => { pending.push(promise); }, passThroughOnException: () => undefined });
    const results = await Promise.allSettled(pending);

    expect(process.env.DATABASE_URL).toBe("postgresql://test.example/timeline");
    expect(state.create).toHaveBeenCalledWith("postgresql://test.example/timeline", { useSupabaseTransactionPooler: true });
    expect(state.sync).toHaveBeenCalledTimes(1);
    expect(state.disconnect).toHaveBeenCalledTimes(1);
    expect(results[0].status).toBe(fails ? "rejected" : "fulfilled");
  });

  it("runs Drive checks without requiring a PostgreSQL database", async () => {
    vi.stubEnv("STORAGE_MODE", "");
    const pending: Promise<unknown>[] = [];
    worker.scheduled({ scheduledTime: Date.now() }, { ASSETS: { fetch: async () => new Response() }, STORAGE_MODE: "google_drive" }, {
      waitUntil: (promise) => { pending.push(promise); }, passThroughOnException: () => undefined,
    });
    await Promise.all(pending);
    expect(state.sync).toHaveBeenCalledTimes(1);
    expect(state.create).not.toHaveBeenCalled();
  });
});
