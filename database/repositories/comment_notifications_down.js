import db from "../databaseConnection.js";

export const getAllCommentsNotificationsDown = async (userId) => {
  const sql = String.raw;
  const commentNotificationsQuery = sql`
    SELECT
        id,
        'comments_down' AS notification_type,
        COALESCE(likes_to_comments.reaction, '[]'::json) AS reactions_to_comments,
        COALESCE(likes_to_replies.reaction_to_replies,  '[]'::json) AS reactions_to_replies,
        COALESCE(other_replies_to_comments.replies, '[]'::json) AS replies_to_comments
    FROM comments
        LEFT JOIN LATERAL (
        SELECT 
            comment_id,
            json_agg(
                json_build_object(
                    'user_name', users.display_name,
                    'reaction_type', comments_reactions.reaction_type,
                    'notification_type', 'comments_down',
                    'created_at', comments_reactions.created_at,
                    'comment_id', comment_id,
                    'comment_post', comments.comment_post
                )
            ) AS reaction FROM comments_reactions
            LEFT JOIN users ON comments_reactions.user_id = users.id
            WHERE comments_reactions.user_id != $1 AND comments_reactions.comment_id = comments.id
            GROUP BY comment_id
    ) likes_to_comments ON true
    LEFT JOIN LATERAL (
        SELECT 
            reply_id,
            json_agg(
                json_build_object(
                    'user_name', users.display_name,
                    'reaction_type', replies_reactions.reaction_type,
                    'notification_type', 'comments_down',
                    'created_at', replies_reactions.created_at,
                    'reply_id', reply_id,
                    'reply_post', replies.reply_post
                )
            ) AS reaction_to_replies  FROM replies_reactions
            LEFT JOIN users ON replies_reactions.user_id = users.id
            LEFT JOIN replies ON replies_reactions.reply_id = replies.id
            WHERE replies_reactions.user_id != $1 AND replies_reactions.reply_id IN (
                SELECT id FROM replies WHERE replies.comment_id = comments.id
            ) 
            GROUP BY reply_id
    ) likes_to_replies ON true 
    LEFT JOIN LATERAL (
        SELECT 
            comment_id,
            json_agg(
                json_build_object(
                    'user_name', users.display_name,
                    'created_at', replies.created_at,
                    'comment_id', replies.comment_id,
                    'comment_post', comments.comment_post,
                    'reply_post', replies.reply_post,
                    'notification_type', 'comments_down'
                )
            ) AS replies FROM replies
            LEFT JOIN users ON replies.user_id = users.id
            WHERE replies.user_id != $1 AND replies.comment_id = comments.id AND comments.post_id IN (
                SELECT id FROM posts WHERE posts.user_id != $1 
            )
            GROUP BY comment_id
    ) other_replies_to_comments ON true 
    WHERE comments.user_id = $1
    AND (
        likes_to_comments.reaction IS NOT NULL
        OR likes_to_replies.reaction_to_replies IS NOT NULL
        OR other_replies_to_comments.replies IS NOT NULL
    );
  `;
  const result = await db.query(commentNotificationsQuery, [userId]);
  return result.rows;
};
