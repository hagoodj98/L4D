import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
//import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";

const app = express();

const port = 3000;

const saltRounds = 10;
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET || "test-session-secret",
    resave: false,
    saveUninitialized: true,
  }),
);

let error;
let existError;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  res.locals.user = req.user ? req.user.display_name : null;
  next();
});

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
if (process.env.NODE_ENV !== "test") {
  db.connect();
}

app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("index.ejs", {
      currentUser: req.user.display_name,
    });
  } else {
    res.render("index.ejs");
  }
});
app.get("/survivors", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("survivors.ejs", {
      currentUser: req.user.display_name,
    });
  } else {
    res.render("survivors.ejs");
  }
});
app.get("/specialinfected", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("specialinfected.ejs", {
      currentUser: req.user.display_name,
    });
  } else {
    res.render("specialinfected.ejs");
  }
});
app.get("/community", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("community.ejs", {
      currentUser: req.user.display_name,
    });
  } else {
    res.render("community.ejs");
  }
});

app.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    console.log("logged in");

    res.redirect("/forum");
  } else {
    res.render("login.ejs", {
      error: error,
    });
  }
});

app.get("/register", (req, res) => {
  res.render("register.ejs", {
    error: existError,
  });
});

app.get("/forum", async (req, res) => {
  if (req.isAuthenticated()) {
    const result = await db.query(
      "SELECT * FROM users JOIN posts ON users.id = posts.user_id WHERE user_id = $1",
      [req.user.id],
    );

    let users = [];

    res.render("forum.ejs", {
      currentUser: req.user.display_name,
      listUser: users,
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

app.get("/forumpost", async (req, res) => {
  if (req.isAuthenticated()) {
    const forumPostQuery = `
     WITH reaction_counts AS (
        SELECT
          post_id,
          COUNT(*) FILTER (WHERE reaction_type = 'like') AS likes,
          COUNT(*) FILTER (WHERE reaction_type = 'dislike') AS dislikes
        FROM posts_reactions
        GROUP BY post_id
      ),
      current_user_post_reactions AS (
        SELECT
          post_id,
          reaction_type
        FROM posts_reactions
        WHERE user_id = $1
      ),
      reactions_comments_counts AS (
        SELECT
          comment_id,
          COUNT(*) FILTER (WHERE reaction_type = 'like') AS likes,
          COUNT(*) FILTER (WHERE reaction_type = 'dislike') AS dislikes
        FROM reactions_comments
        GROUP BY comment_id
      ),
      current_user_comment_reactions AS (
        SELECT
          comment_id,
          reaction_type
        FROM reactions_comments
        WHERE user_id = $1
      ),
      reply_counts AS (
        SELECT
          post_id,
          COUNT(*) AS reply_count
        FROM replies
        GROUP BY post_id
      ),
      replies AS (
        SELECT
          r.id,
          r.post_id,
          r.comment_post,
          r.user_id,
          r.created_at,
          u.display_name
        FROM replies r
        JOIN users u ON u.id = r.user_id
      )
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
      LEFT JOIN reaction_counts rc ON rc.post_id = p.id
      LEFT JOIN current_user_post_reactions cur_pr ON cur_pr.post_id = p.id
      LEFT JOIN reply_counts rep ON rep.post_id = p.id
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN LATERAL (
        SELECT
          post_id,
          json_agg(json_build_object(
            'id', id,
            'comment_post', comment_post,
            'user_id', user_id,
            'created_at', created_at,
            'likes', COALESCE(rcc.likes, 0),
            'dislikes', COALESCE(rcc.dislikes, 0),
            'user_reaction', ccr.reaction_type,
            'display_name', display_name
          ) ORDER BY created_at DESC) AS replies
        FROM replies
        LEFT JOIN reactions_comments_counts rcc ON rcc.comment_id = replies.id
        LEFT JOIN current_user_comment_reactions ccr ON ccr.comment_id = replies.id
        GROUP BY post_id
      ) rp ON rp.post_id = p.id
      ORDER BY p.created_at DESC;
    `;

    const result = await db.query(forumPostQuery, [req.user.id]);

    res.render("forumpost.ejs", {
      currentUser: req.user.display_name,
      listAllContent: result.rows,
    });
  } else {
    res.redirect("/login");
  }
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/forum",
    failureRedirect: "/login-error",
  }),
);

app.get("/login-error", (req, res) => {
  error = "You tried a password, and it was invalid. Try again";
  res.redirect("/login");
});

app.post("/register", async (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/forum");
  }

  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;
  try {
    const checkEmail = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (checkEmail.rows.length > 0) {
      existError = "You typed an email that already exists, try a new one!";
      res.redirect("/register");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (display_name, email, password) VALUES ($1, $2, $3) RETURNING *",
            [username, email, hash],
          );
          const user = result.rows[0];
          req.login(user, (_err) => {
            res.redirect("/forum");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

app.post("/ascend", async (req, res) => {
  if (req.isAuthenticated()) {
    const result = await db.query(
      "SELECT * FROM users JOIN posts ON users.id = posts.user_id ORDER BY created_at DESC",
    );
    const users = result.rows;
    res.render("forumpost.ejs", {
      currentUser: req.user.display_name,
      listAllContent: users,
    });
  }
});
app.post("/post-reaction", async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/login");

  const postId = req.body.post_id;
  const commentId = req.body.comment_post_id;
  const reaction = req.body.reaction || req.body.reaction_comment; // "like" | "dislike"

  if (commentId) {
    // REPLY path: only touch reactions_comments
    const existing = await db.query(
      "SELECT reaction_type FROM reactions_comments WHERE comment_id = $1 AND user_id = $2",
      [commentId, req.user.id],
    );

    if (existing.rows.length && existing.rows[0].reaction_type === reaction) {
      await db.query(
        "DELETE FROM reactions_comments WHERE comment_id = $1 AND user_id = $2",
        [commentId, req.user.id],
      );
    } else {
      //if insert hits a duplicate on this unique key… ON CONFLICT
      //…update existing row instead of throwing error DO UPDATE
      //the row you tried to insert (the “new incoming values”) are referenced as EXCLUDED in the DO UPDATE clause
      await db.query(
        `INSERT INTO reactions_comments (comment_id, user_id, reaction_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, comment_id)
         DO UPDATE SET reaction_type = EXCLUDED.reaction_type`,
        [commentId, req.user.id, reaction],
      );
    }

    return res.redirect("/forumpost");
  }

  if (postId) {
    // POST path: only touch posts_reactions
    const existing = await db.query(
      "SELECT reaction_type FROM posts_reactions WHERE post_id = $1 AND user_id = $2",
      [postId, req.user.id],
    );

    if (existing.rows.length && existing.rows[0].reaction_type === reaction) {
      await db.query(
        "DELETE FROM posts_reactions WHERE post_id = $1 AND user_id = $2",
        [postId, req.user.id],
      );
    } else {
      await db.query(
        `INSERT INTO posts_reactions (post_id, user_id, reaction_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, post_id)
         DO UPDATE SET reaction_type = EXCLUDED.reaction_type`,
        [postId, req.user.id, reaction],
      );
    }

    return res.redirect("/forumpost");
  }

  return res.status(400).send("Missing reaction target");
});

app.post("/descend", async (req, res) => {
  const result = await db.query(
    `
      SELECT * FROM users 
      JOIN posts ON users.id = posts.user_id
      ORDER BY created_at ASC`,
  );
  const users = result.rows;

  res.render("forumpost.ejs", {
    currentUser: req.user.display_name,
    listUser: users,
  });
});

app.post("/add", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  const post = req.body.newPost;
  try {
    let date = new Date();

    await db.query(
      "INSERT INTO posts (post, user_id, created_at) VALUES ($1, $2, $3)",
      [post, req.user.id, date],
    );
    res.redirect("/forumpost");
  } catch (err) {
    console.log(err);
  }
});
app.post("/add-reply", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  const comment_post = req.body.reply;
  const post_id = req.body.post_id;

  console.log(req.body);

  try {
    let date = new Date();

    await db.query(
      "INSERT INTO replies (comment_post, user_id, post_id, created_at) VALUES ($1, $2, $3, $4)",
      [comment_post, req.user.id, post_id, date],
    );
    res.redirect("/forumpost");
  } catch (err) {
    console.log(err);
  }
});
passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query(
        "SELECT * FROM users WHERE display_name = $1 ",
        [username],
      );
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found. Please go back.");
      }
    } catch (err) {
      console.log(err);
    }
  }),
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;
