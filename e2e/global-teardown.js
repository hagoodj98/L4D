import env from "dotenv";
import pg from "pg";

env.config({ override: true });

export default async function globalTeardown() {
  const client = new pg.Client({
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

  try {
    await client.connect();
    await client.query("BEGIN");

    // Deleting e2e users clears their related forum/reaction/notification rows via FK cascades.
    const result = await client.query(
      `
      DELETE FROM users
      WHERE display_name LIKE 'e2e-%'
         OR email LIKE 'e2e-%@example.com'
      RETURNING id
      `,
    );

    await client.query("COMMIT");
    console.log(`[e2e cleanup] Removed ${result.rowCount ?? 0} test users.`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[e2e cleanup] Failed to clean test data:", error);
    throw error;
  } finally {
    await client.end();
  }
}
