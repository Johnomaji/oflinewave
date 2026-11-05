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
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
