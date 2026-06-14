import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Prisma CLI (migrate / db push / db execute) uses this connection string.
  // Use the DIRECT (non-pooled, port 5432) Supabase connection for migrations.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
