import "dotenv/config";
import { Pool } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});
try {
  const tables = await pool.query(
    "select table_schema,table_name from information_schema.tables where table_schema not in ('pg_catalog','information_schema') order by 1,2",
  );
  console.log("Existing tables:", tables.rows);
  if (process.argv[2] === "migrate") {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("select pg_advisory_xact_lock(7314591)");
      await c.query("create schema if not exists morrow");
      await c.query(
        "create table if not exists morrow.migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())",
      );
      for (const name of readdirSync("migrations")
        .filter((n) => n.endsWith(".sql"))
        .sort()) {
        const source = readFileSync("migrations/" + name, "utf8"),
          checksum = createHash("sha256").update(source).digest("hex");
        const previous = await c.query(
          "select checksum from morrow.migrations where name=$1",
          [name],
        );
        if (previous.rows.length) {
          if (previous.rows[0].checksum !== checksum)
            throw Error("Applied migration changed: " + name);
          continue;
        }
        await c.query(source);
        await c.query(
          "insert into morrow.migrations(name,checksum) values($1,$2)",
          [name, checksum],
        );
        console.log("Applied", name);
      }
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
} catch (e) {
  console.error(
    "Database operation failed:",
    e instanceof Error
      ? e.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]")
      : "unknown error",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
