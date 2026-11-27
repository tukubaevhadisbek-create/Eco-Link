import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __ecolinkPool?: Pool };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан. Скопируйте .env.example в .env.local");
  // Внешний адрес базы на Render требует SSL; внутренний (без .render.com) — нет.
  const ssl = /\.render\.com/.test(url) && !/sslmode=/.test(url) ? { rejectUnauthorized: false } : undefined;
  return new Pool({ connectionString: url, max: 10, ssl });
}

export const pool = globalForDb.__ecolinkPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__ecolinkPool = pool;

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
