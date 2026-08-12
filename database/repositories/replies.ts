import db from "../databaseConnection.js";

export const createReply = async (
  reply_post: string | null,
  user_id: number,
  comment_id: string | null,
  created_at: string,
  on_page: string,
) => {
  const sql = String.raw;
  const insertReplyQuery = sql`
    INSERT INTO replies (reply_post, user_id, comment_id, created_at, on_page)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, reply_post, comment_id, created_at, on_page
  `;
  const result = await db.query(insertReplyQuery, [
    reply_post,
    user_id,
    comment_id,
    created_at,
    on_page,
  ]);
  return result.rows[0];
};
