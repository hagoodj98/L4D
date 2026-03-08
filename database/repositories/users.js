import db from "../databaseConnection.js";
export const checkingIfExisting = async (email, username) => {
  const result = await db.query(
    "SELECT EXISTS (SELECT 1 FROM users WHERE email = $1 OR display_name = $2) AS user_exists",
    [email, username],
  );
  return result.rows[0].user_exists;
};

export const createUser = async (username, email, hash) => {
  const result = await db.query(
    "INSERT INTO users (display_name, email, password) VALUES ($1, $2, $3) RETURNING *",
    [username, email, hash],
  );
  return result.rows[0];
};
export const findCredentialsFromLocalPassportStrategy = async (
  username,
  provider,
) => {
  const result = await db.query(
    `SELECT * FROM users WHERE display_name = $1 AND provider = $2`,
    [username, provider],
  );
  return result.rows[0];
};
export const findExistingUserViaPassportStrategyThroughProvider = async (
  profile,
  provider,
) => {
  const result = await db.query(
    `SELECT * FROM users WHERE ${provider}_id = $1`,
    [profile.id],
  );
  return result.rows[0];
};
export const receivedExistingUserViaPassportStrategyProvider = async (
  profile,
) => {
  const result = await db.query(`SELECT * FROM users WHERE email = $1`, [
    profile.email,
  ]);
  return result.rows[0];
};
export const createUserViaPassportStrategyProvider = async (
  profile,
  provider,
) => {
  const result = await db.query(
    `INSERT INTO users (display_name, email, ${provider}_id, ${provider})
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [profile.username, profile.email, profile.id, provider],
  );
  return result.rows[0];
};
