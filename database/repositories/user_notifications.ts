import {
  NotificationSource,
  NotificationState,
  NotificationType,
} from "../../types/types.js";
import db from "../databaseConnection.js";
export const getNotificationState = async (
  userId: number,
): Promise<NotificationState> => {
  const sql = String.raw;
  const getNotificationsReadStatusQuery = sql`
    SELECT notification_state FROM users WHERE id = $1;
  `;
  const result = await db.query(getNotificationsReadStatusQuery, [userId]);

  return result.rows[0];
};
export const saveNotificationState = async (
  userId: number,
  notifications: NotificationType[],
): Promise<NotificationState> => {
  const sql = String.raw;
  const saveNotifcationStateQuery = sql`
      UPDATE users
      SET notification_state=jsonb_set(notification_state, '{notifications}', $2::jsonb)
      WHERE id = $1 RETURNING notification_state;
    `;
  const result = await db.query(saveNotifcationStateQuery, [
    userId,
    JSON.stringify(notifications),
  ]);
  return result.rows[0];
};

export const commentsRepliesNotifications = async (
  userId: number,
  safeSortDirection: "ASC" | "DESC",
  pageSize: number,
): Promise<NotificationSource[]> => {
  const sql = String.raw;
  const commentNotificationsQuery = sql`
    SELECT
        comments.id,
        'comments_down' AS notification_type,
        page_lookup.page_number,
        COALESCE(likes_to_comments.reaction, '[]'::json) AS reactions_to_comments,
        COALESCE(other_replies_to_comments.replies, '[]'::json) AS replies_to_comments
    FROM comments
     LEFT JOIN (
      SELECT
        posts.id,
        ((ROW_NUMBER() OVER (ORDER BY created_at ${safeSortDirection}) - 1) / $2) + 1 AS page_number
      FROM posts
    ) page_lookup ON comments.post_id = page_lookup.id
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
                    'post_id', comments.post_id,
                    'comment_post', comments.comment_post,
                    'on_page', page_lookup.page_number,
                    'source_post', comments.comment_post
                )
            ) AS reaction FROM comments_reactions
            LEFT JOIN users ON comments_reactions.user_id = users.id
            WHERE comments_reactions.user_id != $1 AND comments_reactions.comment_id = comments.id
            GROUP BY comment_id
    ) likes_to_comments ON true
    LEFT JOIN LATERAL (
        SELECT 
            comment_id,
            json_agg(
                json_build_object(
                    'reply_id', replies.id,
                    'user_name', users.display_name,
                    'created_at', replies.created_at,
                    'comment_id', replies.comment_id,
                    'post_id', comments.post_id,
                    'reply_post', replies.reply_post,
                    'notification_type', 'comments_down',
                    'on_page', page_lookup.page_number,
                    'source_post', comments.comment_post
                )
            ) AS replies FROM replies
            LEFT JOIN users ON replies.user_id = users.id
            WHERE replies.user_id != $1 AND replies.comment_id = comments.id
            GROUP BY comment_id
    ) other_replies_to_comments ON true 
    WHERE comments.user_id = $1
    AND (
        likes_to_comments.reaction IS NOT NULL
        OR other_replies_to_comments.replies IS NOT NULL
    );
  `;
  const result = await db.query(commentNotificationsQuery, [userId, pageSize]);
  return result.rows;
};
export const postsCommentsNotifications = async (
  userId: number,
  safeSortDirection: "ASC" | "DESC",
  pageSize: number,
): Promise<NotificationSource[]> => {
  const sql = String.raw;
  const postsCommentsNotificationsQuery = sql`
    SELECT
    posts.id,
    posts.post,
    'posts_down' AS notification_type,
    page_lookup.page_number,
    COALESCE(likes_to_posts.reaction_to_post, '[]'::json) AS reactions_to_posts,
    COALESCE(other_comments_to_posts.comments, '[]'::json) AS other_comments
    FROM posts
    LEFT JOIN (
      SELECT
        id,
        ((ROW_NUMBER() OVER (ORDER BY created_at ${safeSortDirection}) - 1) / $2) + 1 AS page_number
      FROM posts
    ) page_lookup ON posts.id = page_lookup.id
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
                    'source_post', posts.post,
                    'notification_type', 'posts_down',
                    'on_page', page_lookup.page_number
                )
            ) AS reaction_to_post FROM posts_reactions
            LEFT JOIN users ON posts_reactions.user_id = users.id
            WHERE posts_reactions.post_id = posts.id AND posts_reactions.user_id != $1
            GROUP BY post_id
    ) likes_to_posts ON true
    LEFT JOIN LATERAL (
        SELECT
            post_id,
            json_agg(
                json_build_object(
                    'user_name', users.display_name,
                    'comment_post', comment_post,
                    'created_at', comments.created_at,
                    'post_id', post_id,
                    'comment_id', comments.id,
                    'source_post', posts.post,
                    'on_page', page_lookup.page_number,
                    'notification_type', 'posts_down'
                )
            ) AS comments FROM comments
            LEFT JOIN users ON comments.user_id = users.id
            WHERE comments.post_id = posts.id AND comments.user_id != $1
            GROUP BY post_id
    ) other_comments_to_posts ON true
    WHERE posts.user_id = $1 AND (
        likes_to_posts.reaction_to_post IS NOT NULL OR
        other_comments_to_posts.comments IS NOT NULL
    );
`;
  const result = await db.query(postsCommentsNotificationsQuery, [
    userId,
    pageSize,
  ]);
  return result.rows;
};
export const repliesNotifications = async (
  userId: number,
  safeSortDirection: "ASC" | "DESC",
  pageSize: number,
): Promise<NotificationSource[]> => {
  const sql = String.raw;
  const allRepliesNotificationsDownQuery = sql`
  SELECT
    replies.id,
    reply_post,
    'replies_down' AS notification_type,
    user_id,
    page_lookup.page_number,
    COALESCE(likes_to_replies.reactions_to_replies, '[]'::json) AS reactions_to_replies
FROM replies
LEFT JOIN (
      SELECT
        id,
        ((ROW_NUMBER() OVER (ORDER BY created_at ${safeSortDirection}) - 1) / $2) + 1 AS page_number
      FROM replies
    ) page_lookup ON replies.id = page_lookup.id

LEFT JOIN LATERAL (
    SELECT
        reply_id,
        json_agg(
            json_build_object(
                'user_name', users.display_name,
                'reaction_type', replies_reactions.reaction_type,
                'created_at', replies_reactions.created_at,
                'reply_id', replies_reactions.reply_id,
                'source_post', replies.reply_post,
                'reply_post', replies.reply_post,
                'on_page', page_lookup.page_number,
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

  const result = await db.query(allRepliesNotificationsDownQuery, [
    userId,
    pageSize,
  ]);
  return result.rows;
};

export const fetchAllNotifications = async (userId: number) => {
  const postsNotificationsSource: NotificationSource[] =
    await postsCommentsNotifications(userId, "DESC", 4);
  const commentsNotificationSource: NotificationSource[] =
    await commentsRepliesNotifications(userId, "DESC", 4);
  const repliesNotificationsSource: NotificationSource[] =
    await repliesNotifications(userId, "DESC", 4);
  return {
    postsNotificationsSource,
    commentsNotificationSource,
    repliesNotificationsSource,
  };
};
