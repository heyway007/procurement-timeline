import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
const requestPrisma = new AsyncLocalStorage<PrismaClient>();

export const PRISMA_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;

export function createPrismaClient(
  connectionString = process.env.DATABASE_URL,
): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL_NOT_CONFIGURED");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    transactionOptions: PRISMA_TRANSACTION_OPTIONS,
  });
}

export function runWithPrisma<T>(
  prisma: PrismaClient,
  callback: () => Promise<T>,
): Promise<T> {
  return requestPrisma.run(prisma, callback);
}

export function getPrisma(): PrismaClient {
  const scopedPrisma = requestPrisma.getStore();
  if (scopedPrisma) return scopedPrisma;

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}
