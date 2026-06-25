
SELECT 
    users.display_name,
    pr.reaction_type,
   COALESCE(author.post_author, '[]'::json) AS other_user,
   COALESCE(author.post_id, '0') AS parent_post

 FROM posts_reactions pr
LEFT JOIN users ON pr.user_id = users.id
LEFT JOIN (
    SELECT 
        p.id, 
        json_agg(json_build_object('post_id', p.id, 'post_author', users.display_name)) AS post_author
    FROM posts p
    LEFT JOIN users ON p.user_id = users.id
    GROUP BY p.id,users.display_name
) author ON pr.post_id = author.post_id
WHERE pr.user_id = 42
