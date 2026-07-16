import db from "../databaseConnection.js";

export const sameReaction = async (replyId, userId) => {
  const result = await db.query(
    "SELECT reaction_type FROM replies_reactions WHERE reply_id = $1 AND user_id = $2",
    [replyId, userId],
  );
  return result.rows[0];
};

export const addReaction = async (replyId, userId, reactionType, createdAt) => {
  const result = await db.query(
    "INSERT INTO replies_reactions (reply_id, user_id, reaction_type, created_at) VALUES ($1, $2, $3, $4) RETURNING reaction_type",
    [replyId, userId, reactionType, createdAt],
  );
  return result.rows[0];
};
export const removeReaction = async (replyId, userId) => {
  await db.query(
    "DELETE FROM replies_reactions WHERE reply_id = $1 AND user_id = $2",
    [replyId, userId],
  );
};

export const updateReaction = async (replyId, userId, reactionType) => {
  const result = await db.query(
    `INSERT INTO replies_reactions (reply_id, user_id, reaction_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, reply_id)
         DO UPDATE SET reaction_type = EXCLUDED.reaction_type
         RETURNING reaction_type`,
    [replyId, userId, reactionType],
  );
  return result.rows[0];
};
