import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export function createDb(file: string) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

export type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { __pow_db?: Db };

export function getDb(): Db {
  globalForDb.__pow_db ??= createDb(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "proof-of-work.db"));
  return globalForDb.__pow_db;
}
