import { afterEach, describe, expect, it, vi } from "vitest";
import { adjustProjectStep, ApiError } from "@/lib/ui/api-client";

describe("api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns non-JSON server responses into a readable ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!DOCTYPE html><html></html>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(
      adjustProjectStep("project-1", 2, "2026-07-17", 1),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง",
      status: 500,
    } satisfies Partial<ApiError>);
  });
});
