import { ZodError, z } from "zod";
import { describe, expect, it } from "vitest";
import { mapProjectError } from "@/lib/projects/http";

describe("mapProjectError", () => {
  it("maps stale versions to HTTP 409 with a Thai message", () => {
    expect(mapProjectError(new Error("PROJECT_VERSION_CONFLICT"))).toEqual({
      status: 409,
      body: {
        code: "PROJECT_VERSION_CONFLICT",
        message: "ข้อมูลนี้ถูกแก้ไขจากผู้ใช้อื่น กรุณาโหลดข้อมูลล่าสุด",
      },
    });
  });

  it("maps missing projects to HTTP 404", () => {
    expect(mapProjectError(new Error("PROJECT_NOT_FOUND"))).toMatchObject({
      status: 404,
      body: { code: "PROJECT_NOT_FOUND" },
    });
  });

  it("maps validation errors to HTTP 422", () => {
    let error: ZodError | undefined;
    try {
      z.object({ name: z.string().min(1) }).parse({ name: "" });
    } catch (caught) {
      error = caught as ZodError;
    }
    expect(mapProjectError(error)).toMatchObject({
      status: 422,
      body: { code: "VALIDATION_ERROR" },
    });
  });
});
