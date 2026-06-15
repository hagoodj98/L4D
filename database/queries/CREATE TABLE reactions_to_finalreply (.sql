CREATE TABLE reactions_to_finalreply (
    reply_id INTEGER REFERENCES replies_final_tier(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(10) CHECK (reaction_type IN ('like', 'dislike')),
    PRIMARY KEY (reply_id, user_id)
);
