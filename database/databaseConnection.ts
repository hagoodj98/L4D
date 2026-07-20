import env from "dotenv";
import pg from "pg";

env.config({ override: true });

const db = new pg.Client({
  user: process.env.PG_USER || "postgres",
  host: process.env.PG_HOST || "localhost",
  database: process.env.PG_DATABASE || "forum",
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT ? Number(process.env.PG_PORT) : 5432,
});
if (process.env.NODE_ENV !== "test") {
  db.connect();
}

export default db;
