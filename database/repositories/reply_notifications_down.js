import db from "../databaseConnection.js";

export const getAllRepliesNotificationsDown = async (userId) => {
  const sql = String.raw;
  const allRepliesNotificationsDownQuery = sql`
  SELECT
    replies.id,
    reply_post,
    'replies_down' AS notification_type,
    user_id,
    COALESCE(likes_to_replies.reactions_to_replies, '[]'::json) AS reactions_to_replies
FROM replies
LEFT JOIN LATERAL (
    SELECT
        reply_id,
        json_agg(
            json_build_object(
                'user_name', users.display_name,
                'reaction_type', replies_reactions.reaction_type,
                'created_at', replies_reactions.created_at,
                'reply_id', replies_reactions.reply_id,
                'the_reply', replies.reply_post,
                'notification_type', 'replies_down'
            )
        ) AS reactions_to_replies 
    FROM replies_reactions
    LEFT JOIN users ON replies_reactions.user_id = users.id
    WHERE replies_reactions.user_id != $1 AND replies_reactions.reply_id = replies.id
    GROUP BY reply_id
) likes_to_replies ON true
WHERE replies.user_id = $1 AND (
    likes_to_replies.reactions_to_replies IS NOT NULL
);`;

  const result = await db.query(allRepliesNotificationsDownQuery, [userId]);
  return result.rows;
};
