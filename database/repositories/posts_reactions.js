import db from "../databaseConnection.js";

export const existing = async (postId, userId) => {
  const result = await db.query(
    "SELECT reaction_type FROM posts_reactions WHERE post_id = $1 AND user_id = $2",
    [postId, userId],
  );
  return result.rows[0];
};

export const addReaction = async (postId, userId, reactionType) => {
  await db.query(
    `INSERT INTO posts_reactions (post_id, user_id, reaction_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, post_id)
         DO UPDATE SET reaction_type = EXCLUDED.reaction_type`,
    [postId, userId, reactionType],
  );
};

export const removeReaction = async (postId, userId) => {
  await db.query(
    "DELETE FROM posts_reactions WHERE post_id = $1 AND user_id = $2",
    [postId, userId],
  );
};
