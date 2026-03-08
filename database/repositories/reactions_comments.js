import db from "../databaseConnection.js";

export const existing = async (commentId, userId) => {
  const result = await db.query(
    "SELECT reaction_type FROM reactions_comments WHERE comment_id = $1 AND user_id = $2",
    [commentId, userId],
  );
  return result.rows[0];
};

export const addReaction = async (commentId, userId, reactionType) => {
  const result = await db.query(
    "INSERT INTO reactions_comments (comment_id, user_id, reaction_type) VALUES ($1, $2, $3) RETURNING *",
    [commentId, userId, reactionType],
  );
  return result.rows[0];
};
export const removeReaction = async (commentId, userId) => {
  await db.query(
    "DELETE FROM reactions_comments WHERE comment_id = $1 AND user_id = $2",
    [commentId, userId],
  );
};

export const updateReaction = async (commentId, userId, reactionType) => {
  const result = await db.query(
    `INSERT INTO reactions_comments (comment_id, user_id, reaction_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, comment_id)
         DO UPDATE SET reaction_type = EXCLUDED.reaction_type`,
    [commentId, userId, reactionType],
  );
  return result.rows[0];
};
