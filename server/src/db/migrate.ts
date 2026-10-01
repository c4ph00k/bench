import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";

/** An advisory-lock namespace for this one schema, so two instances never race a migration. */
const LOCK_KEY = 924_510_001;

/**
 * Apply the numbered `.sql` migrations in `dir` that have not run yet, in name order.
 * The lock is held for the whole pass on one connection, and each file commits or rolls back
 * on its own, so a failed migration leaves the earlier ones in place and the later ones untouched.
 */
export async function migrate(pool: Pool, dir: string): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const files = (await readdir(dir))
      .filter((name) => name.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));
    const applied: string[] = [];
    for (const file of files) {
      const done = await client.query(
        "SELECT 1 FROM schema_migrations WHERE id = $1",
        [file],
      );
      if (done.rows.length > 0) continue;
      const sql = await readFile(path.join(dir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      applied.push(file);
    }
    return applied;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    client.release();
  }
}
