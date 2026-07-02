SELECT
    replies.id,
    reply_post,
    user_id,
    COALESCE(likes_to_replies.reaction_to_replies, '[]'::json) AS reaction_to_replies
FROM replies
LEFT JOIN LATERAL (
    SELECT
        reply_id,
        json_agg(
            json_build_object(
                'user_name', users.display_name,
                'reaction_type', reaction_type,
                'created_at', reactions_replies.created_at,
                'reply_id', reactions_replies.reply_id,
                'the_reply', replies.reply_post
            )
        ) AS reaction_to_replies 
    FROM reactions_replies
    LEFT JOIN users ON reactions_replies.user_id = users.id
    WHERE reactions_replies.user_id != 42 AND reactions_replies.reply_id = replies.id
    GROUP BY reply_id
) likes_to_replies ON true
WHERE replies.user_id = 42 AND (
    likes_to_replies.reaction_to_replies IS NOT NULL
)