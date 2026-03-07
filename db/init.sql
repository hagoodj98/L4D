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

CREATE TABLE IF NOT EXISTS replies (
  id SERIAL PRIMARY KEY,
  comment_post TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  comment TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO replies (id, comment_post, user_id, post_id, created_at)
SELECT c.id, c.comment, c.user_id, c.post_id, c.created_at
FROM comments c
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
