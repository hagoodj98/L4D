import db from "../databaseConnection.js";
import type { Post } from "../../types/types.js";
export const createPost = async (
  postContent: string,
  userId: number,
  createdAt: string,
  onPage: string,
): Promise<Post> => {
  const sql = String.raw;
  const insertPostQuery = sql`
    INSERT INTO posts (post, user_id, created_at, on_page)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const result = await db.query(insertPostQuery, [
    postContent,
    userId,
    createdAt,
    onPage,
  ]);
  return result.rows[0];
};
