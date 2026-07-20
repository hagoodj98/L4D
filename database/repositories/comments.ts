import db from "../databaseConnection.js";

export const createComment = async (
  comment_post: string | null,
  user_id: number,
  post_id: string | null,
  created_at: string,
) => {
  const sql = String.raw;
  const insertCommentQuery = sql`
    INSERT INTO comments (comment_post, user_id, post_id, created_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const result = await db.query(insertCommentQuery, [
    comment_post,
    user_id,
    post_id,
    created_at,
  ]);
  return result.rows[0];
};
