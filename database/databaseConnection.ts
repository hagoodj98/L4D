import env from "dotenv";
import pg from "pg";

env.config({ override: true });

// Ensure TIMESTAMP WITHOUT TIME ZONE values are interpreted as UTC.
// This prevents hour shifts when Node runs in a different local timezone.
if (pg.types?.setTypeParser) {
  pg.types.setTypeParser(1114, (value: string) => {
    const isoValue = value.includes("T") ? value : value.replace(" ", "T");
    return new Date(`${isoValue}Z`);
  });
}

const db = new pg.Client({
  user: process.env.PG_USER || "postgres",
  host: process.env.PG_HOST || "localhost",
  database: process.env.PG_DATABASE || "forum",
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT ? Number(process.env.PG_PORT) : 5432,
  ssl:
    process.env.PG_HOST && process.env.PG_HOST !== "localhost"
      ? { rejectUnauthorized: false }
      : undefined,
});
if (process.env.NODE_ENV !== "test") {
  db.connect();
}

export default db;
