import db from "../databaseConnection.js";

export const existing = async (postId, userId) => {
  const result = await db.query(
    "SELECT reaction_type FROM reactions_posts WHERE post_id = $1 AND user_id = $2",
    [postId, userId],
  );
  return result.rows[0];
};

export const addReaction = async (postId, userId, reactionType, createdAt) => {
  const result = await db.query(
    `INSERT INTO reactions_posts (post_id, user_id, reaction_type, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, post_id)
         DO UPDATE SET reaction_type = EXCLUDED.reaction_type RETURNING reaction_type`,
    [postId, userId, reactionType, createdAt],
  );
  return result.rows[0];
};

export const removeReaction = async (postId, userId) => {
  await db.query(
    "DELETE FROM reactions_posts WHERE post_id = $1 AND user_id = $2",
    [postId, userId],
  );
};
export const updateReaction = async (postId, userId, reactionType) => {
  const result = await db.query(
    `INSERT INTO reactions_posts (post_id, user_id, reaction_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, post_id)
         DO UPDATE SET reaction_type = EXCLUDED.reaction_type RETURNING reaction_type`,
    [postId, userId, reactionType],
  );
  return result.rows[0];
};
