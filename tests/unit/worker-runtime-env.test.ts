import { afterEach, describe, expect, it, vi } from "vitest";
import { syncRuntimeEnv } from "@/worker/runtime-env";

describe("worker runtime environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes DATABASE_URL from Cloudflare bindings to process.env", () => {
    vi.stubEnv("DATABASE_URL", "");

    syncRuntimeEnv({
      DATABASE_URL: "postgresql://production.example/timeline",
    });

    expect(process.env.DATABASE_URL).toBe(
      "postgresql://production.example/timeline",
    );
  });
});
