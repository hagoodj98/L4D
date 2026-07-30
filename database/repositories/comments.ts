import db from "../databaseConnection.js";

export const createComment = async (
  comment_post: string | null,
  user_id: number,
  post_id: string | null,
  created_at: string,
  on_page: string,
) => {
  const sql = String.raw;
  const insertCommentQuery = sql`
    INSERT INTO comments (comment_post, user_id, post_id, created_at, on_page)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const result = await db.query(insertCommentQuery, [
    comment_post,
    user_id,
    post_id,
    created_at,
    on_page,
  ]);
  return result.rows[0];
};
