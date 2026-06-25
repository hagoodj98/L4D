SELECT 
    users.display_name,
    pr.reaction_type,
    pr.post_id
 FROM posts_reactions pr
LEFT JOIN users ON pr.user_id = users.id









 