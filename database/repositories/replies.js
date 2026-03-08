import db from "../databaseConnection.js";

export const createReply = async (comment_post, user_id, post_id) => {
  await db.query(
    "INSERT INTO replies (comment_post, user_id, post_id, created_at) VALUES ($1, $2, $3, $4)",
    [comment_post, user_id, post_id, new Date()],
  );
};
