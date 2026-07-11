import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "agentos.db");
const MIGRATIONS_FOLDER = path.join(process.cwd(), "src", "lib", "db", "migrations");

declare global {
  var __agentosSqlite: Database.Database | undefined;
}

function createConnection() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

// Reuse the connection across Next.js dev-server hot reloads.
const sqlite = globalThis.__agentosSqlite ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalThis.__agentosSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });

let migrated = false;
export function ensureMigrated() {
  if (migrated) return;
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  migrated = true;
}
