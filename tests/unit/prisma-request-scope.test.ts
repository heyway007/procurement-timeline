import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { getPrisma, runWithPrisma } from "@/lib/db/prisma";

function fakePrismaClient(id: string): PrismaClient {
  return { id } as unknown as PrismaClient;
}

describe("Prisma request scope", () => {
  it("keeps concurrent Worker requests on their own Prisma client", async () => {
    const firstClient = fakePrismaClient("first");
    const secondClient = fakePrismaClient("second");

    const [firstObserved, secondObserved] = await Promise.all([
      runWithPrisma(firstClient, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return getPrisma();
      }),
      runWithPrisma(secondClient, async () => getPrisma()),
    ]);

    expect(firstObserved).toBe(firstClient);
    expect(secondObserved).toBe(secondClient);
  });
});
