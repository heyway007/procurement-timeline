import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
const requestPrisma = new AsyncLocalStorage<PrismaClient>();
const SUPABASE_POOLER_HOST_SUFFIX = ".pooler.supabase.com";

export const PRISMA_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;

export function toWorkerDatabaseUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (
      url.hostname.endsWith(SUPABASE_POOLER_HOST_SUFFIX) &&
      url.port === "5432"
    ) {
      url.port = "6543";
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}

export function createPrismaClient(
  connectionString = process.env.DATABASE_URL,
  options: { useSupabaseTransactionPooler?: boolean } = {},
): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL_NOT_CONFIGURED");
  }

  const runtimeConnectionString = options.useSupabaseTransactionPooler
    ? toWorkerDatabaseUrl(connectionString)
    : connectionString;

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: runtimeConnectionString,
      max: 1,
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 5_000,
    }),
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
