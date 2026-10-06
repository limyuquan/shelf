import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "./migrations.ts";

export type Db = Database;

/**
 * Opens (creating and migrating if needed) the shelf database.
 * Several agents may run shelf concurrently, so the connection uses WAL, waits on
 * locks, and every write goes through `writeTransaction` (BEGIN IMMEDIATE).
 */
export function openDatabase(file: string): Db {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file, { create: true, strict: true });
  // Generous: parallel agents on a slow or busy disk can hold the lock for seconds.
  db.run("PRAGMA busy_timeout = 15000");
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA foreign_keys = ON");
  migrate(db);
  return db;
}

/**
 * Runs `fn` in a BEGIN IMMEDIATE transaction. Deferred transactions that upgrade
 * from read to write fail instantly with SQLITE_BUSY under contention instead of
 * waiting, so all writes take the write lock up front.
 */
export function writeTransaction<T>(db: Db, fn: () => T): T {
  return db.transaction(fn).immediate();
}
