import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // process.env rather than env(): `prisma generate` runs on every npm install (including on
  // build servers before variables are set) and doesn't need a database.
  // Migrations take an advisory lock, which Neon's pooled URL can't hold; prefer the direct one.
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
});
