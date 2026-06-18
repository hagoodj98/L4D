
        SELECT 
            post_id,
            COUNT(*) AS likes
        FROM posts_reactions
        GROUP BY post_id
      
