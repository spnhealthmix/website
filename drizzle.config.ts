import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});

// Setup:
//   npm i drizzle-orm @neondatabase/serverless
//   npm i -D drizzle-kit tsx
//
// package.json scripts:
//   "db:generate": "drizzle-kit generate",
//   "db:migrate":  "drizzle-kit migrate",
//   "db:seed":     "tsx src/lib/db/seed.ts"
//
// Use a separate DATABASE_URL (Neon branch) for development and production.
