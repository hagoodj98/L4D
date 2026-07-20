import { ReactionType } from "../../types/types.js";
import db from "../databaseConnection.js";

export const sameReaction = async (
  commentId: string | null,
  userId: number,
): Promise<ReactionType> => {
  const sql = String.raw;
  const getNotificationsReadStatusQuery = sql`
    SELECT reaction_type
    FROM comments_reactions
    WHERE comment_id = $1 AND user_id = $2
  `;
  const result = await db.query(getNotificationsReadStatusQuery, [
    commentId,
    userId,
  ]);
  return result.rows[0];
};

export const addReaction = async (
  commentId: string | null,
  userId: number,
  reactionType: string,
  createdAt: string,
): Promise<ReactionType> => {
  const sql = String.raw;
  const insertReactionQuery = sql`
    INSERT INTO comments_reactions (comment_id, user_id, reaction_type, created_at)
    VALUES ($1, $2, $3, $4)
    RETURNING reaction_type
  `;
  const result = await db.query(insertReactionQuery, [
    commentId,
    userId,
    reactionType,
    createdAt,
  ]);
  return result.rows[0];
};
export const removeReaction = async (
  commentId: string | null,
  userId: number,
): Promise<void> => {
  const sql = String.raw;
  const deleteReactionQuery = sql`
    DELETE FROM comments_reactions WHERE comment_id = $1 AND user_id = $2
  `;
  await db.query(deleteReactionQuery, [commentId, userId]);
};

export const updateReaction = async (
  commentId: string | null,
  userId: number,
  reactionType: string,
): Promise<ReactionType> => {
  const sql = String.raw;
  const upsertReactionQuery = sql`
    INSERT INTO comments_reactions (comment_id, user_id, reaction_type)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, comment_id)
    DO UPDATE SET reaction_type = EXCLUDED.reaction_type
    RETURNING reaction_type
  `;
  const result = await db.query(upsertReactionQuery, [
    commentId,
    userId,
    reactionType,
  ]);
  return result.rows[0];
};
