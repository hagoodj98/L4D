CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  post TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  comment TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
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
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON posts(created_at);

CREATE INDEX IF NOT EXISTS idx_posts_user_id
  ON posts(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_post_id
  ON comments(post_id);

CREATE INDEX IF NOT EXISTS idx_comments_user_id
  ON comments(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_created_at
  ON comments(created_at);

CREATE INDEX IF NOT EXISTS idx_posts_reactions_post_id
  ON posts_reactions(post_id);

CREATE INDEX IF NOT EXISTS idx_posts_reactions_user_id
  ON posts_reactions(user_id);

CREATE INDEX IF NOT EXISTS idx_reactions_comments_comment_id
  ON reactions_comments(comment_id);

CREATE INDEX IF NOT EXISTS idx_reactions_comments_user_id
  ON reactions_comments(user_id);
