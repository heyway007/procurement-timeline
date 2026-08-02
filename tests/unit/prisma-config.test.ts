import { describe, expect, it } from "vitest";
import {
  PRISMA_TRANSACTION_OPTIONS,
  toWorkerDatabaseUrl,
} from "@/lib/db/prisma";

describe("Prisma runtime configuration", () => {
  it("allows remote Worker transactions enough time for Supabase round trips", () => {
    expect(PRISMA_TRANSACTION_OPTIONS).toEqual({
      maxWait: 10_000,
      timeout: 30_000,
    });
  });

  it("uses Supabase transaction pooling for Worker database requests", () => {
    const connectionString =
      "postgresql://user:secret@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require";

    expect(toWorkerDatabaseUrl(connectionString)).toBe(
      "postgresql://user:secret@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require",
    );
  });
});
