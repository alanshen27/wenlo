import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
// import { readReplicas } from "@prisma/extension-read-replicas";
import { Pool } from "pg";

/**
 * Prisma 7 uses driver adapters, so connection strings are configured here at
 * runtime (the schema/`prisma.config.ts` only handle the CLI/migrations).
 *
 * Read replicas are disabled for now — everything runs against the primary
 * (`DATABASE_URL`). To re-enable region-aware read routing, uncomment the
 * `readReplicas` import and the replica blocks below.
 */

// --- Read replicas (disabled) ---------------------------------------------
// /** Map a Vercel execution region to the closest replica connection string. */
// const REPLICA_URL_BY_REGION: Record<string, string | undefined> = {
//   fra1: process.env.DATABASE_URL_REPLICA_EU, // Frankfurt
//   iad1: process.env.DATABASE_URL_REPLICA_US_EAST, // Washington D.C.
// };
//
// function pickReplicaUrl(): string | undefined {
//   const region = process.env.VERCEL_REGION;
//   const regional = region ? REPLICA_URL_BY_REGION[region] : undefined;
//   // Fall back to a single generic replica, then to nothing (primary-only).
//   return regional ?? process.env.DATABASE_URL_REPLICA;
// }
// --------------------------------------------------------------------------

function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    // Supabase terminates TLS with a chain node-postgres doesn't trust by
    // default; matches Prisma v6's previous "ignore invalid cert" behavior.
    ssl: { rejectUnauthorized: false },
  });
}

function createPrismaClient(): PrismaClient {
  const primaryUrl = process.env.DATABASE_URL;
  if (!primaryUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const base = new PrismaClient({
    adapter: new PrismaPg(createPool(primaryUrl)),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return base;

  // --- Read replicas (disabled) -------------------------------------------
  // const replicaUrl = pickReplicaUrl();
  // if (!replicaUrl) return base;
  //
  // const replicaClient = new PrismaClient({
  //   adapter: new PrismaPg(createPool(replicaUrl)),
  // });
  //
  // // The read-replicas extension must be applied last.
  // return base.$extends(
  //   readReplicas({ replicas: [replicaClient] })
  // ) as unknown as PrismaClient;
  // ------------------------------------------------------------------------
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
