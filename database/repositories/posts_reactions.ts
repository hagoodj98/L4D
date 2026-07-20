import { ReactionType } from "../../types/types.js";
import db from "../databaseConnection.js";

export const sameReaction = async (
  postID: string | null,
  userID: number,
): Promise<ReactionType> => {
  const sql = String.raw;
  const getNotificationsReadStatusQuery = sql`
    SELECT reaction_type
    FROM posts_reactions
    WHERE post_id = $1 AND user_id = $2
  `;
  const result = await db.query(getNotificationsReadStatusQuery, [
    postID,
    userID,
  ]);
  return result.rows[0];
};

export const addReaction = async (
  postID: string | null,
  userID: number,
  reactionType: string,
  createdAt: string,
): Promise<ReactionType> => {
  const sql = String.raw;
  const insertReactionQuery = sql`
    INSERT INTO posts_reactions (post_id, user_id, reaction_type, created_at)
    VALUES ($1, $2, $3, $4)
    RETURNING reaction_type
  `;
  const result = await db.query(insertReactionQuery, [
    postID,
    userID,
    reactionType,
    createdAt,
  ]);
  return result.rows[0];
};

export const removeReaction = async (
  postID: string | null,
  userID: number,
): Promise<void> => {
  const sql = String.raw;
  const deleteReactionQuery = sql`
    DELETE FROM posts_reactions WHERE post_id = $1 AND user_id = $2
  `;
  await db.query(deleteReactionQuery, [postID, userID]);
};
export const updateReaction = async (
  postID: string | null,
  userID: number,
  reactionType: string,
): Promise<ReactionType> => {
  const sql = String.raw;
  const upsertReactionQuery = sql`
    INSERT INTO posts_reactions (post_id, user_id, reaction_type)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, post_id)
    DO UPDATE SET reaction_type = EXCLUDED.reaction_type
    RETURNING reaction_type
  `;

  const result = await db.query(upsertReactionQuery, [
    postID,
    userID,
    reactionType,
  ]);
  return result.rows[0];
};
