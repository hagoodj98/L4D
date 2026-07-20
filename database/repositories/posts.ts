import db from "../databaseConnection.js";
import type { Post } from "../../types/types.js";
export const createPost = async (
  postContent: string,
  userId: number,
  createdAt: string,
): Promise<Post> => {
  const sql = String.raw;
  const insertPostQuery = sql`
    INSERT INTO posts (post, user_id, created_at)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const result = await db.query(insertPostQuery, [
    postContent,
    userId,
    createdAt,
  ]);
  return result.rows[0];
};
