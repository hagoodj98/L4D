import { NotificationSource } from "../../types/types.js";
import db from "../databaseConnection.js";

export const getAllForumData = async (
  userId: number | null,
  sortDirection = "DESC",
  limit = 4,
  offset = 0,
): Promise<NotificationSource[]> => {
  const safeSortDirection = sortDirection === "ASC" ? "ASC" : "DESC";
  // Using String.raw to construct the SQL query with dynamic sort direction
  const sql = String.raw;

  const forumPostQuery = sql`
    SELECT 
      posts.id,
      posts.post,
      posts.created_at,
      posts.user_id,
      users.display_name,
      current_user_pr.reaction_type AS current_user_reaction,
      COALESCE(pr_count.likes, 0) AS likes,
      COALESCE(pr_count.dislikes, 0) AS dislikes,
      COALESCE(comment_count.total, 0) AS comment_count,
      COALESCE(all_comment_data.one_comment_data, '[]'::json) AS comments
    FROM posts
    LEFT JOIN users ON posts.user_id = users.id
    LEFT JOIN posts_reactions current_user_pr
      ON current_user_pr.post_id = posts.id AND current_user_pr.user_id = $1
    LEFT JOIN (
      SELECT
        post_id,
        COUNT(reaction_type) FILTER (WHERE reaction_type = 'like') AS likes,
        COUNT(reaction_type) FILTER (WHERE reaction_type = 'dislike') AS dislikes
      FROM posts_reactions
      GROUP BY post_id
    ) pr_count ON posts.id = pr_count.post_id
    LEFT JOIN (
      SELECT
          post_id,
          COUNT(comment_post) AS total
      FROM comments
      GROUP BY post_id
    ) comment_count ON posts.id = comment_count.post_id
    LEFT JOIN LATERAL(
      SELECT
        comments.post_id,
        json_agg(
          json_build_object(
            'id', comments.id,
            'comment_post', comments.comment_post,
            'post_id', comments.post_id,
            'created_at', comments.created_at,
            'user_id', comments.user_id,
            'display_name', users.display_name,
            'current_user_reaction', current_user_cr.reaction_type,
            'likes', COALESCE(cr_count.likes, 0),
            'dislikes', COALESCE(cr_count.dislikes, 0),
            'reply_count', COALESCE(reply_count.count, 0),
            'replies', COALESCE(all_reply_data.one_reply_data, '[]'::json)
          )
          ORDER BY comments.created_at DESC
        ) AS one_comment_data FROM comments
    LEFT JOIN users ON comments.user_id = users.id
    LEFT JOIN comments_reactions current_user_cr ON current_user_cr.comment_id = comments.id AND current_user_cr.user_id = $1
    LEFT JOIN (
      SELECT
        comment_id,
        COUNT(reaction_type) FILTER (WHERE reaction_type = 'like') AS likes,
        COUNT(reaction_type) FILTER (WHERE reaction_type = 'dislike') AS dislikes
      FROM comments_reactions
      GROUP BY comment_id 
    ) cr_count ON comments.id = cr_count.comment_id
    LEFT JOIN (
      SELECT
        comment_id,
        COUNT(replies.reply_post) AS count
      FROM replies
      GROUP BY comment_id
    ) reply_count ON reply_count.comment_id = comments.id
    LEFT JOIN LATERAL (
      SELECT 
        replies.comment_id,
        json_agg(
          json_build_object(
            'id', replies.id,
            'user_id', replies.user_id,
            'reply_post', replies.reply_post,
            'comment_id', replies.comment_id,
            'post_id', comments.post_id,
            'created_at', replies.created_at,
            'display_name', users.display_name,
            'current_user_reaction', replies_reactions.reaction_type,
            'likes', COALESCE(rr_count.like_count, 0),
            'dislikes', COALESCE(rr_count.dislike_count, 0)
          )
          ORDER BY replies.created_at DESC
        ) AS one_reply_data FROM replies
      JOIN users ON replies.user_id = users.id
      LEFT JOIN replies_reactions ON replies_reactions.reply_id = replies.id AND replies_reactions.user_id = $1
      LEFT JOIN (
        SELECT
          reply_id,
          COUNT(reaction_type) FILTER (WHERE reaction_type = 'like') AS like_count,
          COUNT(reaction_type) FILTER (WHERE reaction_type = 'dislike') AS dislike_count
        FROM replies_reactions
        GROUP BY reply_id
      ) rr_count ON replies.id = rr_count.reply_id
      WHERE replies.comment_id = comments.id
      GROUP BY replies.comment_id
    ) all_reply_data ON true
    WHERE posts.id = comments.post_id
    GROUP BY comments.post_id
    ) all_comment_data ON true
    ORDER BY posts.created_at ${safeSortDirection}
    LIMIT $2 OFFSET $3 
    `;
  const result = await db.query(forumPostQuery, [userId, limit, offset]);
  return result.rows;
};

export const totalPostsResult = async (): Promise<string> => {
  const result = await db.query("SELECT COUNT(*) FROM posts");
  return result.rows[0].count;
};
