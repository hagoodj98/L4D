import db from "../databaseConnection.js";

export const getForumPosts = async (
  userId = null,
  sortDirection = "DESC",
  limit = 4,
  offset = 0,
) => {
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
      posts_reactions.reaction_type AS current_user_reaction,
      COALESCE(reactions.like_count, 0) AS likes,
      COALESCE(reactions.dislike_count, 0) AS dislikes,
      COALESCE(reply_count, 0) AS reply_count,
      COALESCE(replies, '[]'::json) AS replies
    FROM posts
    LEFT JOIN users ON posts.user_id = users.id
    LEFT JOIN posts_reactions 
      ON posts_reactions.post_id = posts.id AND posts_reactions.user_id = $1
    LEFT JOIN (
      SELECT
        post_id,
        COUNT(reaction_type) FILTER (WHERE reaction_type = 'like') AS like_count,
        COUNT(reaction_type) FILTER (WHERE reaction_type = 'dislike') AS dislike_count
      FROM posts_reactions
      GROUP BY post_id
    ) reactions ON posts.id = reactions.post_id
    LEFT JOIN (
      SELECT
          post_id,
          COUNT(comment_post) AS reply_count
      FROM replies
      GROUP BY post_id
    ) reply_count ON posts.id = reply_count.post_id
    LEFT JOIN LATERAL(
      SELECT
        replies.post_id,
        json_agg(
          json_build_object(
            'id', replies.id,
            'comment_post', replies.comment_post,
            'created_at', replies.created_at,
            'user_id', replies.user_id,
            'display_name', users.display_name,
            'current_user_reaction', reactions_comments.reaction_type,
            'likes', COALESCE(reactions_comments_count.like_count, 0),
            'dislikes', COALESCE(reactions_comments_count.dislike_count, 0),
            'reply_count', COALESCE(rft.final_replies_count, 0),
            'replies_final_tier', COALESCE(replies_final_tier.final_replies, '[]'::json)
          )
          ORDER BY replies.created_at DESC
        ) AS replies FROM replies
      JOIN users ON replies.user_id = users.id
    LEFT JOIN reactions_comments ON reactions_comments.comment_id = replies.id AND reactions_comments.user_id = $1
    LEFT JOIN (
      SELECT
        comment_id,
        COUNT(reaction_type) FILTER (WHERE reaction_type = 'like') AS like_count,
        COUNT(reaction_type) FILTER (WHERE reaction_type = 'dislike') AS dislike_count
      FROM reactions_comments
      GROUP BY comment_id 
    ) reactions_comments_count ON replies.id = reactions_comments_count.comment_id
    LEFT JOIN (
      SELECT
        rft.reply_id,
        COUNT(rft.comment_post) AS final_replies_count
      FROM replies_final_tier rft
      GROUP BY rft.reply_id
    ) rft ON rft.reply_id = replies.id
    LEFT JOIN LATERAL (
      SELECT 
        replies_final_tier.reply_id,
        json_agg(
          json_build_object(
            'id', replies_final_tier.id,
            'user_id', replies_final_tier.user_id,
            'comment_post', replies_final_tier.comment_post,
            'created_at', replies_final_tier.created_at,
            'display_name', users.display_name,
            'current_user_reaction', reactions_to_finalreply.reaction_type,
            'likes', COALESCE(reactions_to_finalreply_count.like_count, 0),
            'dislikes', COALESCE(reactions_to_finalreply_count.dislike_count, 0)
          )
          ORDER BY replies_final_tier.created_at DESC
        ) AS final_replies FROM replies_final_tier
      JOIN users ON replies_final_tier.user_id = users.id
      LEFT JOIN reactions_to_finalreply ON reactions_to_finalreply.reply_id = replies_final_tier.id AND reactions_to_finalreply.user_id = $1
      LEFT JOIN (
        SELECT
          reply_id,
          COUNT(reaction_type) FILTER (WHERE reaction_type = 'like') AS like_count,
          COUNT(reaction_type) FILTER (WHERE reaction_type = 'dislike') AS dislike_count
        FROM reactions_to_finalreply
        GROUP BY reply_id
      ) reactions_to_finalreply_count ON replies_final_tier.id = reactions_to_finalreply_count.reply_id
      WHERE replies_final_tier.reply_id = replies.id
      GROUP BY replies_final_tier.reply_id
    ) replies_final_tier ON true
    WHERE posts.id = replies.post_id
    GROUP BY replies.post_id
    ) replies ON true
    ORDER BY posts.created_at ${safeSortDirection}
    LIMIT $2 OFFSET $3 
    `;

  return db.query(forumPostQuery, [userId, limit, offset]);
};

export const totalPostsResult = async () =>
  await db.query("SELECT COUNT(*) FROM posts");

export const createPost = async (postContent, userId) => {
  const result = await db.query(
    "INSERT INTO posts (post, user_id, created_at) VALUES ($1, $2, $3) RETURNING *",
    [postContent, userId, new Date()],
  );
  return result.rows[0];
};
