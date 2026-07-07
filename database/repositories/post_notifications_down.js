import db from "../databaseConnection.js";

export const getAllPostNotificationsDown = async (userId) => {
  const sql = String.raw;
  const allPostNotificationsDownQuery = sql`
    SELECT
        posts.id,
        posts.post,
        'posts_down' AS notification_type,
        COALESCE(likes_to_posts.reaction_to_post, '[]'::json) AS reactions_to_posts,
        COALESCE(likes_to_comments.reaction_to_comment, '[]'::json) AS reactions_to_comments,
        COALESCE(likes_to_replies.reaction_to_replies, '[]'::json) AS reactions_to_replies,
        COALESCE(other_comments_to_posts.comments, '[]'::json) AS other_comments,
        COALESCE(other_replies_to_comments.other_replies, '[]'::json) AS other_replies
    FROM posts
    LEFT JOIN LATERAL (
        SELECT
            post_id,
            json_agg(
                json_build_object(
                    'user_name', users.display_name,
                    'reaction_type', reaction_type,
                    'created_at', created_at,
                    'post_id', post_id,
                    'post', posts.post,
                    'notification_type', 'posts_down'
                )
            ) AS reaction_to_post FROM posts_reactions
            LEFT JOIN users ON posts_reactions.user_id = users.id
            WHERE posts_reactions.post_id = posts.id AND posts_reactions.user_id != $1
            GROUP BY post_id
    ) likes_to_posts ON true
    LEFT JOIN LATERAL (
        SELECT 
            comments_reactions.comment_id,
            json_agg(
                json_build_object(
                    'user_name', users.display_name,
                    'reaction_type', comments_reactions.reaction_type,
                    'created_at', comments_reactions.created_at,
                    'comment_id', comments.id,
                    'comment_post', comments.comment_post,
                    'notification_type', 'posts_down'
                )
            ) AS reaction_to_comment FROM comments_reactions
                LEFT JOIN users ON comments_reactions.user_id = users.id
                LEFT JOIN comments ON comments_reactions.comment_id = comments.id
            WHERE comments_reactions.user_id != $1 AND comments_reactions.comment_id IN (
                SELECT id FROM comments WHERE comments.user_id = $1 AND comments.post_id = posts.id
            )
            GROUP BY comment_id
    ) likes_to_comments ON true
    LEFT JOIN LATERAL (
        SELECT
            replies_reactions.reply_id,
            json_agg(
                json_build_object(
                    'user_name', users.display_name,
                    'reaction_type', replies_reactions.reaction_type,
                    'created_at', replies_reactions.created_at,
                    'reply_id', replies_reactions.reply_id,
                    'reply_post', replies.reply_post,
                    'notification_type', 'posts_down'
                    
                )
            ) AS reaction_to_replies FROM replies_reactions
            LEFT JOIN users ON replies_reactions.user_id = users.id
            LEFT JOIN replies ON replies_reactions.reply_id = replies.id
            WHERE replies_reactions.user_id != $1 AND replies_reactions.reply_id IN (
                SELECT id FROM replies WHERE replies.comment_id IN (
                    SELECT id FROM comments WHERE comments.user_id = $1 AND comments.post_id = posts.id
                )
            )
            GROUP BY replies_reactions.reply_id
    ) likes_to_replies ON true
    LEFT JOIN LATERAL (
        SELECT
            post_id,
            json_agg(
                json_build_object(
                    'user_name', users.display_name,
                    'comment_post', comment_post,
                    'created_at', created_at,
                    'post_id', post_id,
                    'notification_type', 'posts_down',
                    'post', posts.post
                )
            ) AS comments FROM comments
            LEFT JOIN users ON comments.user_id = users.id
            WHERE comments.post_id = posts.id AND comments.user_id != $1
            GROUP BY post_id
    ) other_comments_to_posts ON true
    LEFT JOIN LATERAL (
        SELECT
            comment_id,
            json_agg(
                json_build_object(
                    'user_name', users.display_name,
                    'reply_post', replies.reply_post,
                    'created_at', replies.created_at,
                    'comment_id', replies.comment_id,
                    'notification_type', 'posts_down'
                )
            ) AS other_replies FROM replies
            LEFT JOIN users ON replies.user_id = users.id
            WHERE replies.user_id != $1 AND replies.comment_id IN (
                SELECT id FROM comments WHERE comments.user_id = $1 AND comments.post_id = posts.id
            )
            GROUP BY comment_id
    ) other_replies_to_comments ON true
    WHERE posts.user_id = $1 AND (
        likes_to_posts.reaction_to_post IS NOT NULL OR
        likes_to_comments.reaction_to_comment IS NOT NULL OR
        likes_to_replies.reaction_to_replies IS NOT NULL OR
        other_comments_to_posts.comments IS NOT NULL OR
        other_replies_to_comments.other_replies IS NOT NULL
    );
`;
  const result = await db.query(allPostNotificationsDownQuery, [userId]);
  return result.rows;
};
