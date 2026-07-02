import db from "../databaseConnection.js";

export const sameReaction = async (commentId, userId) => {
  const result = await db.query(
    "SELECT reaction_type FROM comments_reactions WHERE comment_id = $1 AND user_id = $2",
    [commentId, userId],
  );
  return result.rows[0];
};

export const addReaction = async (
  commentId,
  userId,
  reactionType,
  createdAt,
) => {
  const result = await db.query(
    "INSERT INTO comments_reactions (comment_id, user_id, reaction_type, created_at) VALUES ($1, $2, $3, $4) RETURNING reaction_type",
    [commentId, userId, reactionType, createdAt],
  );
  return result.rows[0];
};
export const removeReaction = async (commentId, userId) => {
  await db.query(
    "DELETE FROM comments_reactions WHERE comment_id = $1 AND user_id = $2",
    [commentId, userId],
  );
};

export const updateReaction = async (commentId, userId, reactionType) => {
  const result = await db.query(
    `INSERT INTO comments_reactions (comment_id, user_id, reaction_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, comment_id)
         DO UPDATE SET reaction_type = EXCLUDED.reaction_type
         RETURNING reaction_type`,
    [commentId, userId, reactionType],
  );
  return result.rows[0];
};
