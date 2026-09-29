import { Database } from "bun:sqlite";
import type { Sql } from "../src/actors/shared.ts";

/** An in-memory SQLite behind the same `Sql` the actors use, for testing SQL without a server. */
export function memorySql(): { db: Database; sql: Sql } {
  const db = new Database(":memory:");
  return {
    db,
    sql: { execute: async (q: string, ...args: unknown[]) => db.query(q).all(...(args as never[])) },
  };
}
