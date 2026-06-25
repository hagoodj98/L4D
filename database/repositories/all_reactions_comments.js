import db from "../databaseConnection.js";

export const getAllReactionsComments = async (userId) => {
  const sql = String.raw;
  const allReactionsCommentsQuery = sql`
  SELECT 
    posts.id,
    posts.post,
    COALESCE(users.other_users, '[]'::json) AS users
    FROM posts
    LEFT JOIN LATERAL (
        SELECT
            post_id,
            json_agg(
                json_build_object(
                    'user_name', users.display_name,
                    'reaction_type', reaction_type
                )
            ) AS other_users FROM posts_reactions
            LEFT JOIN users ON posts_reactions.user_id = users.id
            WHERE posts_reactions.post_id = posts.id
            GROUP BY post_id
    ) users ON true
    WHERE posts.user_id = $1 AND users.other_users IS NOT NULL`;
  const result = await db.query(allReactionsCommentsQuery, [userId]);
  return result.rows;
};
