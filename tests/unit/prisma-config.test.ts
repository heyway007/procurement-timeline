import { describe, expect, it } from "vitest";
import { PRISMA_TRANSACTION_OPTIONS } from "@/lib/db/prisma";

describe("Prisma runtime configuration", () => {
  it("allows remote Worker transactions enough time for Supabase round trips", () => {
    expect(PRISMA_TRANSACTION_OPTIONS).toEqual({
      maxWait: 10_000,
      timeout: 30_000,
    });
  });
});
