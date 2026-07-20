import db from "../databaseConnection.js";

export const createReply = async (
  comment_post: string | null,
  user_id: number,
  comment_id: string | null,
  created_at: string,
) => {
  const sql = String.raw;
  const insertReplyQuery = sql`
    INSERT INTO replies (reply_post, user_id, comment_id, created_at)
    VALUES ($1, $2, $3, $4)
    RETURNING id, reply_post, comment_id, created_at
  `;
  const result = await db.query(insertReplyQuery, [
    comment_post,
    user_id,
    comment_id,
    created_at,
  ]);
  return result.rows[0];
};
