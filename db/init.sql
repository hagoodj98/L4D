CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  twitch_id VARCHAR(255) UNIQUE,
  discord_id VARCHAR(255) UNIQUE,
  provider VARCHAR(20) NOT NULL DEFAULT 'local'
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS twitch_id VARCHAR(255);
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS discord_id VARCHAR(255);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'local';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_state JSONB NOT NULL DEFAULT '{"notifications": []}'::jsonb;

ALTER TABLE users
  ALTER COLUMN password DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique
  ON users(google_id)
  WHERE google_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_twitch_id_unique
  ON users(twitch_id)
  WHERE twitch_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id_unique
  ON users(discord_id)
  WHERE discord_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  post TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  comment_post TEXT,
  comment TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS replies (
  id SERIAL PRIMARY KEY,
  reply_post TEXT,
  comment_post TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id INTEGER,
  post_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS on_page TEXT;

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS on_page TEXT;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS on_page TEXT;

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS comment_post TEXT;

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS comment TEXT;

UPDATE comments
SET comment_post = comment
WHERE comment_post IS NULL AND comment IS NOT NULL;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS reply_post TEXT;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS comment_post TEXT;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS comment_id INTEGER;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS post_id INTEGER;

UPDATE replies
SET reply_post = comment_post
WHERE reply_post IS NULL AND comment_post IS NOT NULL;

INSERT INTO replies (id, comment_post, reply_post, user_id, post_id, created_at)
SELECT
  c.id,
  COALESCE(c.comment_post, c.comment),
  COALESCE(c.comment_post, c.comment),
  c.user_id,
  c.post_id,
  c.created_at
FROM comments c
WHERE COALESCE(c.comment_post, c.comment) IS NOT NULL
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('replies', 'id'),
  COALESCE((SELECT MAX(id) FROM replies), 1),
  true
);

CREATE TABLE IF NOT EXISTS posts_reactions (
  id SERIAL PRIMARY KEY,
  reaction_type VARCHAR(10) CHECK (reaction_type IN ('like', 'dislike')) NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS reactions_comments (
  id SERIAL PRIMARY KEY,
  reaction_type VARCHAR(10) CHECK (reaction_type IN ('like', 'dislike')) NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id INTEGER NOT NULL REFERENCES replies(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, comment_id)
);

CREATE TABLE IF NOT EXISTS comments_reactions (
  id SERIAL PRIMARY KEY,
  reaction_type VARCHAR(10) CHECK (reaction_type IN ('like', 'dislike')) NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, comment_id)
);

CREATE TABLE IF NOT EXISTS replies_final_tier (
  id SERIAL PRIMARY KEY,
  comment_post TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reply_id INTEGER NOT NULL REFERENCES replies(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reactions_to_finalreply (
  reply_id INTEGER NOT NULL REFERENCES replies_final_tier(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(10) CHECK (reaction_type IN ('like', 'dislike')) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (reply_id, user_id)
);

CREATE TABLE IF NOT EXISTS replies_reactions (
  id SERIAL PRIMARY KEY,
  reaction_type VARCHAR(10) CHECK (reaction_type IN ('like', 'dislike')) NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reply_id INTEGER NOT NULL REFERENCES replies(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, reply_id)
);

INSERT INTO comments_reactions (comment_id, user_id, reaction_type, created_at)
SELECT comment_id, user_id, reaction_type, created_at
FROM reactions_comments
ON CONFLICT (user_id, comment_id) DO NOTHING;

INSERT INTO replies_reactions (reply_id, user_id, reaction_type, created_at)
SELECT reply_id, user_id, reaction_type, created_at
FROM reactions_to_finalreply
ON CONFLICT (user_id, reply_id) DO NOTHING;

ALTER TABLE reactions_comments
  DROP CONSTRAINT IF EXISTS reactions_comments_comment_id_fkey;

ALTER TABLE reactions_comments
  ADD CONSTRAINT reactions_comments_comment_id_fkey
  FOREIGN KEY (comment_id) REFERENCES replies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON posts(created_at);

CREATE INDEX IF NOT EXISTS idx_posts_user_id
  ON posts(user_id);

CREATE INDEX IF NOT EXISTS idx_replies_post_id
  ON replies(post_id);

CREATE INDEX IF NOT EXISTS idx_comments_post_id
  ON comments(post_id);

CREATE INDEX IF NOT EXISTS idx_replies_comment_id
  ON replies(comment_id);

CREATE INDEX IF NOT EXISTS idx_replies_user_id
  ON replies(user_id);

CREATE INDEX IF NOT EXISTS idx_replies_created_at
  ON replies(created_at);

CREATE INDEX IF NOT EXISTS idx_posts_reactions_post_id
  ON posts_reactions(post_id);

CREATE INDEX IF NOT EXISTS idx_posts_reactions_user_id
  ON posts_reactions(user_id);

CREATE INDEX IF NOT EXISTS idx_reactions_comments_comment_id
  ON reactions_comments(comment_id);

CREATE INDEX IF NOT EXISTS idx_reactions_comments_user_id
  ON reactions_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_reactions_comment_id
  ON comments_reactions(comment_id);

CREATE INDEX IF NOT EXISTS idx_comments_reactions_user_id
  ON comments_reactions(user_id);

CREATE INDEX IF NOT EXISTS idx_replies_final_tier_reply_id
  ON replies_final_tier(reply_id);

CREATE INDEX IF NOT EXISTS idx_replies_final_tier_user_id
  ON replies_final_tier(user_id);

CREATE INDEX IF NOT EXISTS idx_replies_final_tier_created_at
  ON replies_final_tier(created_at);

CREATE INDEX IF NOT EXISTS idx_reactions_to_finalreply_reply_id
  ON reactions_to_finalreply(reply_id);

CREATE INDEX IF NOT EXISTS idx_reactions_to_finalreply_user_id
  ON reactions_to_finalreply(user_id);

CREATE INDEX IF NOT EXISTS idx_replies_reactions_reply_id
  ON replies_reactions(reply_id);

CREATE INDEX IF NOT EXISTS idx_replies_reactions_user_id
  ON replies_reactions(user_id);
