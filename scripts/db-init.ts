import env from "dotenv";
import { spawnSync } from "node:child_process";

env.config({ override: true });

const host = process.env.PG_HOST || "localhost";
const user = process.env.PG_USER || "postgres";
const database = process.env.PG_DATABASE || "forum";
const port = String(process.env.PG_PORT || "5432");

const result = spawnSync(
  "psql",
  [
    "-v",
    "ON_ERROR_STOP=1",
    "-h",
    host,
    "-U",
    user,
    "-d",
    database,
    "-p",
    port,
    "-f",
    "db/init.sql",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PGPASSWORD: process.env.PG_PASSWORD || process.env.PGPASSWORD || "",
    },
  },
);

if (result.error) {
  if (result.error.code === "ENOENT") {
    process.stderr.write(
      "psql command not found. Install PostgreSQL client tools and ensure `psql` is in PATH.\n",
    );
  } else {
    process.stderr.write(`${result.error.message}\n`);
  }
  process.exit(1);
}

process.exit(result.status ?? 1);
