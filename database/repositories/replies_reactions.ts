import db from "../databaseConnection.js";

import { ReactionType } from "../../types/types.js";

export const sameReaction = async (
  replyId: string | null,
  userId: number,
): Promise<ReactionType> => {
  const sql = String.raw;
  const getNotificationsReadStatusQuery = sql`
    SELECT reaction_type
    FROM replies_reactions
    WHERE reply_id = $1 AND user_id = $2
  `;
  const result = await db.query(getNotificationsReadStatusQuery, [
    replyId,
    userId,
  ]);
  return result.rows[0];
};

export const addReaction = async (
  replyId: string | null,
  userId: number,
  reactionType: string,
  createdAt: string,
): Promise<ReactionType> => {
  const sql = String.raw;
  const insertReactionQuery = sql`
    INSERT INTO replies_reactions (reply_id, user_id, reaction_type, created_at)
    VALUES ($1, $2, $3, $4)
    RETURNING reaction_type
  `;
  const result = await db.query(insertReactionQuery, [
    replyId,
    userId,
    reactionType,
    createdAt,
  ]);
  return result.rows[0];
};
export const removeReaction = async (
  replyId: string | null,
  userId: number,
): Promise<void> => {
  const sql = String.raw;
  const deleteReactionQuery = sql`
    DELETE FROM replies_reactions WHERE reply_id = $1 AND user_id = $2
  `;
  await db.query(deleteReactionQuery, [replyId, userId]);
};

export const updateReaction = async (
  replyId: string | null,
  userId: number,
  reactionType: string,
): Promise<ReactionType> => {
  const sql = String.raw;
  const upsertReactionQuery = sql`
    INSERT INTO replies_reactions (reply_id, user_id, reaction_type)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, reply_id)
    DO UPDATE SET reaction_type = EXCLUDED.reaction_type
    RETURNING reaction_type
  `;
  const result = await db.query(upsertReactionQuery, [
    replyId,
    userId,
    reactionType,
  ]);
  return result.rows[0];
};
