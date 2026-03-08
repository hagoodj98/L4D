import db from "../databaseConnection.js";

export const getForumPosts = async (
  userId = null,
  sortDirection = "DESC",
  limit = 4,
  offset = 0,
) => {
  const safeSortDirection = sortDirection === "ASC" ? "ASC" : "DESC";

  const forumPostQuery = `
      SELECT
        p.id,
        p.updated_at,
        p.post,
        p.user_id,
        p.created_at,
        COALESCE(rc.likes, 0) AS likes,
        COALESCE(rc.dislikes, 0) AS dislikes,
        COALESCE(rep.reply_count, 0) AS reply_count,
        cur_pr.reaction_type AS user_reaction,
        u.display_name,
        COALESCE(rp.replies, '[]'::json) AS replies
      FROM posts p
      LEFT JOIN (
        SELECT
          post_id,
          COUNT(*) FILTER (WHERE reaction_type = 'like') AS likes,
          COUNT(*) FILTER (WHERE reaction_type = 'dislike') AS dislikes
        FROM posts_reactions
        GROUP BY post_id
      ) rc ON rc.post_id = p.id
      LEFT JOIN posts_reactions cur_pr
        ON cur_pr.post_id = p.id AND cur_pr.user_id = $1
      LEFT JOIN (
        SELECT
          post_id,
          COUNT(*) AS reply_count
        FROM replies
        GROUP BY post_id
      ) rep ON rep.post_id = p.id
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN LATERAL (
        SELECT
          r.post_id,
          json_agg(
            json_build_object(
              'id', r.id,
              'comment_post', r.comment_post,
              'user_id', r.user_id,
              'created_at', r.created_at,
              'likes', COALESCE(rcc.likes, 0),
              'dislikes', COALESCE(rcc.dislikes, 0),
              'user_reaction', ccr.reaction_type,
              'display_name', ru.display_name
            )
            ORDER BY r.created_at DESC
          ) AS replies
        FROM replies r
        LEFT JOIN users ru ON ru.id = r.user_id
        LEFT JOIN (
          SELECT
            comment_id,
            COUNT(*) FILTER (WHERE reaction_type = 'like') AS likes,
            COUNT(*) FILTER (WHERE reaction_type = 'dislike') AS dislikes
          FROM reactions_comments
          GROUP BY comment_id
        ) rcc ON rcc.comment_id = r.id
        LEFT JOIN reactions_comments ccr
          ON ccr.comment_id = r.id AND ccr.user_id = $1
        WHERE r.post_id = p.id
        GROUP BY r.post_id
      ) rp ON true
      ORDER BY p.created_at ${safeSortDirection}
      LIMIT $2 OFFSET $3 
    `;

  return db.query(forumPostQuery, [userId, limit, offset]);
};

export const totalPostsResult = async () =>
  await db.query("SELECT COUNT(*) FROM posts");

export const createPost = async (postContent, userId) => {
  await db.query(
    "INSERT INTO posts (post, user_id, created_at) VALUES ($1, $2, $3)",
    [postContent, userId, new Date()],
  );
};
