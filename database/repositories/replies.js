import db from "../databaseConnection.js";

export const createReply = async (comment_post, user_id, post_id) => {
  const result = await db.query(
    "INSERT INTO replies (comment_post, user_id, post_id, created_at) VALUES ($1, $2, $3, $4) RETURNING *",
    [comment_post, user_id, post_id, new Date()],
  );
  return result.rows[0];
};
