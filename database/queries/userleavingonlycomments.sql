SELECT
    id,
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
                'reaction_type', reactions_comments.reaction_type,
                'created_at', reactions_comments.created_at,
                'comment', comment_id,
                'the_comment', comments.comment_post
            )
        ) AS reaction FROM reactions_comments
        LEFT JOIN users ON reactions_comments.user_id = users.id
        WHERE reactions_comments.user_id != 42 AND reactions_comments.comment_id = comments.id
        GROUP BY comment_id
) likes_to_comments ON true
LEFT JOIN LATERAL (
    SELECT 
        reply_id,
        json_agg(
            json_build_object(
                'user_name', users.display_name,
                'reaction_type', reactions_replies.reaction_type,
                'created_at', reactions_replies.created_at,
                'reply', reply_id,
                'the_reply', replies.reply_post
            )
        ) AS reaction_to_replies  FROM reactions_replies
        LEFT JOIN users ON reactions_replies.user_id = users.id
        LEFT JOIN replies ON reactions_replies.reply_id = replies.id
        WHERE reactions_replies.user_id != 42 AND reactions_replies.reply_id IN (
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
                'comment', replies.comment_id,
                'the_comment', comments.comment_post,
                'the_reply', replies.reply_post
            )
        ) AS replies FROM replies
        LEFT JOIN users ON replies.user_id = users.id
        WHERE replies.user_id != 42 AND replies.comment_id = comments.id AND comments.post_id IN (
            SELECT id FROM posts WHERE posts.user_id != 42 
        )
        GROUP BY comment_id
) other_replies_to_comments ON true 

WHERE comments.user_id = 42
AND (
    likes_to_comments.reaction IS NOT NULL
    OR likes_to_replies.reaction_to_replies IS NOT NULL
    OR other_replies_to_comments.replies IS NOT NULL
);