import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import Twitch from "passport-twitch-strategy";
import DiscordStrategy from "passport-discord";
import session from "express-session";
import env from "dotenv";
import { z } from "zod";
import ErrorHandler from "./utils/error.js";

const TwitchStrategy = Twitch.Strategy;

const registrationSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});
const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});
const reactionSchema = z.object({
  post_id: z.string().optional(),
  comment_post_id: z.string().optional(),
  reaction: z.enum(["like", "dislike"]).optional(),
  reaction_comment: z.enum(["like", "dislike"]).optional(),
});
const postSchema = z.object({
  newPost: z.string().min(1, "Post content cannot be empty"),
});
const replySchema = z.object({
  reply: z.string().min(1, "Reply content cannot be empty"),
  post_id: z.string().min(1, "Post ID is required for a reply"),
});
const sortSchema = z.object({
  sortDirection: z.enum(["ASC", "DESC"]),
});

const app = express();

const port = 3000;

const saltRounds = 10;
env.config();

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || "test-google-client-id";
const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || "test-google-client-secret";
const TWITCH_CLIENT_ID =
  process.env.TWITCH_CLIENT_ID || "test-twitch-client-id";
const TWITCH_CLIENT_SECRET =
  process.env.TWITCH_CLIENT_SECRET || "test-twitch-client-secret";
const DISCORD_CLIENT_ID =
  process.env.DISCORD_CLIENT_ID || "test-discord-client-id";
const DISCORD_CLIENT_SECRET =
  process.env.DISCORD_CLIENT_SECRET || "test-discord-client-secret";

if (process.env.NODE_ENV !== "test") {
  const missingOAuthEnvVars = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "TWITCH_CLIENT_ID",
    "TWITCH_CLIENT_SECRET",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
  ].filter((key) => !process.env[key]);

  if (missingOAuthEnvVars.length > 0) {
    console.warn(
      `Warning: Missing OAuth environment variables: ${missingOAuthEnvVars.join(", ")}. Social login may not work until these are set.`,
    );
  }
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "test-session-secret",
    resave: false,
    saveUninitialized: true,
  }),
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  res.locals.user = req.user ? req.user.display_name : null;
  res.locals.currentPath = req.path;
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

const getForumPosts = async (
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

app.get("/", (req, res) => {
  if (!req.isAuthenticated()) return res.render("index.ejs");
  res.render("index.ejs", {
    currentUser: req.user.display_name,
  });
});
app.get("/survivors", (req, res) => {
  if (!req.isAuthenticated()) return res.render("survivors.ejs");
  res.render("survivors.ejs", {
    currentUser: req.user.display_name,
  });
});
app.get("/specialinfected", (req, res) => {
  if (!req.isAuthenticated()) return res.render("specialinfected.ejs");
  res.render("specialinfected.ejs", {
    currentUser: req.user.display_name,
  });
});
app.get("/community", (req, res) => {
  if (!req.isAuthenticated()) return res.render("community.ejs");
  res.render("community.ejs", {
    currentUser: req.user.display_name,
  });
});
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
app.get(
  "/auth/twitch",
  passport.authenticate("twitch", { scope: ["user:read:email"] }),
);
app.get(
  "/auth/discord",
  passport.authenticate("discord", { scope: ["identify", "email"] }),
);
app.get(
  "/auth/twitch/forum",
  passport.authenticate("twitch", {
    successRedirect: "/forum",
    failureRedirect: "/login",
  }),
);

app.get(
  "/auth/discord/forum",
  passport.authenticate("discord", {
    successRedirect: "/forum",
    failureRedirect: "/login",
  }),
);
app.get(
  "/auth/google/forum",
  passport.authenticate("google", {
    successRedirect: "/forum",
    failureRedirect: "/login",
  }),
);
app.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/forum");
  } else {
    const formErrors = req.session.formErrors || null;
    req.session.formErrors = null;
    res.render("login.ejs", {
      error: formErrors,
    });
  }
});

app.get("/register", (req, res) => {
  const formErrors = req.session.formErrors || null;

  req.session.formErrors = null;
  res.render("register.ejs", {
    error: formErrors,
  });
});

app.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

app.get("/forum", async (req, res) => {
  const validation = sortSchema.safeParse({ sortDirection: "DESC" });
  if (!validation.success) {
    return res.status(400).send("Invalid sort direction");
  }
  const limit = req.query.limit ? parseInt(req.query.limit) : 4;
  const offset = req.query.page ? (parseInt(req.query.page) - 1) * limit : 0;
  const result = await getForumPosts(
    req.user ? req.user.id : null,
    "DESC",
    limit,
    offset,
  );
  const totalPostsResult = await db.query("SELECT COUNT(*) FROM posts");

  const totalPosts = totalPostsResult.rows[0].count;
  res.render("forum.ejs", {
    currentUser: req.user ? req.user.display_name : "Guest",
    isAuthenticated: req.isAuthenticated(),
    listAllContent: result.rows,
    totalPosts,
  });
});

app.post("/login", async (req, res, next) => {
  passport.authenticate("local", function (err, user, info) {
    const validation = loginSchema.safeParse({
      username: req.body.username,
      password: req.body.password,
    });

    if (!validation.success) {
      return next(
        new ErrorHandler(400, "Validation failed", {
          username: validation.error.issues.find(
            (err) => err.path[0] === "username",
          )
            ? validation.error.issues.find((err) => err.path[0] === "username")
                .message
            : null,
          password: validation.error.issues.find(
            (err) => err.path[0] === "password",
          )
            ? validation.error.issues.find((err) => err.path[0] === "password")
                .message
            : null,
        }),
      );
    }
    if (err) {
      return next(err);
    }
    if (!user) {
      if (info && info.message === "User not found") {
        return next(new ErrorHandler(401, "User not found", info));
      }

      return next(new ErrorHandler(401, "Invalid credentials", info));
      // return res.redirect("/login-error");
    }
    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }
      return res.redirect("/forum");
    });
  })(req, res, next);
});

app.post("/register", async (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect("/forum");
  }

  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;
  const validation = registrationSchema.safeParse({
    username,
    email,
    password,
  });

  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Registration failed", {
        username: validation.error.issues.find(
          (err) => err.path[0] === "username",
        )
          ? validation.error.issues.find((err) => err.path[0] === "username")
              .message
          : null,
        email: validation.error.issues.find((err) => err.path[0] === "email")
          ? validation.error.issues.find((err) => err.path[0] === "email")
              .message
          : null,
        password: validation.error.issues.find(
          (err) => err.path[0] === "password",
        )
          ? validation.error.issues.find((err) => err.path[0] === "password")
              .message
          : null,
      }),
    );
  }

  try {
    const checkingIfExisting = await db.query(
      "SELECT EXISTS (SELECT 1 FROM users WHERE email = $1 OR display_name = $2) AS user_exists",
      [email, username],
    );

    if (checkingIfExisting.rows[0].user_exists) {
      return next(
        new ErrorHandler(400, "User already exists", {
          duplicateInfo:
            "You typed an email or username that already exists, try a new one!",
        }),
      );
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          return next(new ErrorHandler(500, "Error hashing password"));
        } else {
          const result = await db.query(
            "INSERT INTO users (display_name, email, password) VALUES ($1, $2, $3) RETURNING *",
            [username, email, hash],
          );
          const user = result.rows[0];
          req.login(user, (loginError) => {
            if (loginError) {
              return next(loginError);
            }
            return res.redirect("/forum");
          });
        }
      });
    }
  } catch (err) {
    return next(err);
  }
});

app.post("/ascend", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/login");

  const validation = sortSchema.safeParse({ sortDirection: "ASC" });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid sort direction", validation.error.issues),
    );
  }
  const result = await getForumPosts(req.user.id, "ASC");

  res.render("forum.ejs", {
    currentUser: req.user.display_name,
    isAuthenticated: true,
    listAllContent: result.rows,
  });
});
app.post("/post-reaction", async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/login");

  const postId = req.body.post_id;
  const commentId = req.body.comment_post_id;
  const reaction = req.body.reaction || req.body.reaction_comment; // "like" | "dislike"

  const validation = reactionSchema.safeParse({
    post_id: postId,
    comment_post_id: commentId,
    reaction,
    reaction_comment: reaction,
  });

  if (!validation.success) {
    return res.status(400).send("Invalid reaction data");
  }

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

    return res.redirect("/forum");
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

    return res.redirect("/forum");
  }

  return res.status(400).send("Missing reaction target");
});

app.post("/descend", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/login");
  const validation = sortSchema.safeParse({ sortDirection: "DESC" });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid sort direction", validation.error.issues),
    );
  }

  const result = await getForumPosts(req.user.id, "DESC");

  res.render("forum.ejs", {
    currentUser: req.user.display_name,
    isAuthenticated: true,
    listAllContent: result.rows,
  });
});

app.post("/add-post", async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  const post = req.body.newPost;

  const validation = postSchema.safeParse({ newPost: post });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid post data", validation.error.issues),
    );
  }

  try {
    let date = new Date();

    await db.query(
      "INSERT INTO posts (post, user_id, created_at) VALUES ($1, $2, $3)",
      [post, req.user.id, date],
    );
    res.redirect("/forum");
  } catch (err) {
    console.log(err);
  }
});
app.post("/add-reply", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/login");

  const comment_post = req.body.reply;
  const post_id = req.body.post_id;

  const validation = replySchema.safeParse({ reply: comment_post, post_id });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid reply data", validation.error.issues),
    );
  }

  console.log(req.body);

  try {
    let date = new Date();

    await db.query(
      "INSERT INTO replies (comment_post, user_id, post_id, created_at) VALUES ($1, $2, $3, $4)",
      [comment_post, req.user.id, post_id, date],
    );
    res.redirect("/forum");
  } catch (err) {
    console.log(err);
    return next(new ErrorHandler(500, "Internal Server Error", err));
  }
});
passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query(
        "SELECT * FROM users WHERE display_name = $1 AND provider = 'local'",
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
              return cb(null, false, { message: "Invalid password" });
            }
          }
        });
      } else {
        return cb(null, false, { message: "User not found" });
      }
    } catch (err) {
      console.log(err);
      return cb(err);
    }
  }),
);
passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/forum",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async function verify(accessToken, refreshToken, profile, cb) {
      try {
        const existingGoogleUser = await db.query(
          "SELECT * FROM users WHERE google_id = $1",
          [profile.id],
        );

        if (existingGoogleUser.rows.length > 0) {
          return cb(null, existingGoogleUser.rows[0]);
        }

        const googleEmail = profile.emails?.[0]?.value;
        if (!googleEmail) {
          return cb(
            new Error("Google account did not return an email address"),
          );
        }

        const existingEmailUser = await db.query(
          "SELECT * FROM users WHERE email = $1",
          [googleEmail],
        );

        if (existingEmailUser.rows.length > 0) {
          const linkedUser = await db.query(
            `UPDATE users
             SET google_id = $1, provider = 'google'
             WHERE id = $2
             RETURNING *`,
            [profile.id, existingEmailUser.rows[0].id],
          );
          return cb(null, linkedUser.rows[0]);
        }

        const newUserResult = await db.query(
          `INSERT INTO users (display_name, email, google_id, provider)
           VALUES ($1, $2, $3, 'google')
           RETURNING *`,
          [profile.displayName, googleEmail, profile.id],
        );

        return cb(null, newUserResult.rows[0]);
      } catch (err) {
        console.log(err);
        return cb(err);
      }
    },
  ),
);
passport.use(
  "twitch",
  new TwitchStrategy(
    {
      clientID: TWITCH_CLIENT_ID,
      clientSecret: TWITCH_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/twitch/forum",
    },
    async function verify(accessToken, refreshToken, profile, cb) {
      try {
        const existingTwitchUser = await db.query(
          "SELECT * FROM users WHERE twitch_id = $1",
          [profile.id],
        );

        if (existingTwitchUser.rows.length > 0) {
          return cb(null, existingTwitchUser.rows[0]);
        }

        const twitchEmail = profile?.email;
        if (!twitchEmail) {
          return cb(
            new Error("Twitch account did not return an email address"),
          );
        }

        const existingEmailUser = await db.query(
          "SELECT * FROM users WHERE email = $1",
          [twitchEmail],
        );

        if (existingEmailUser.rows.length > 0) {
          const linkedUser = await db.query(
            `UPDATE users
             SET twitch_id = $1, provider = 'twitch'
             WHERE id = $2
             RETURNING *`,
            [profile.id, existingEmailUser.rows[0].id],
          );
          return cb(null, linkedUser.rows[0]);
        }

        const newUserResult = await db.query(
          `INSERT INTO users (display_name, email, twitch_id, provider)
           VALUES ($1, $2, $3, 'twitch')
           RETURNING *`,
          [profile.displayName, twitchEmail, profile.id],
        );

        return cb(null, newUserResult.rows[0]);
      } catch (err) {
        console.log(err);
        return cb(err);
      }
    },
  ),
);
passport.use(
  "discord",
  new DiscordStrategy(
    {
      clientID: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/discord/forum",
      scope: ["identify", "email"],
    },
    async function verify(accessToken, refreshToken, profile, cb) {
      try {
        const existingDiscordUser = await db.query(
          "SELECT * FROM users WHERE discord_id = $1",
          [profile.id],
        );

        if (existingDiscordUser.rows.length > 0) {
          return cb(null, existingDiscordUser.rows[0]);
        }

        const discordEmail = profile?.email;
        if (!discordEmail) {
          return cb(
            new Error("Discord account did not return an email address"),
          );
        }

        const existingEmailUser = await db.query(
          "SELECT * FROM users WHERE email = $1",
          [discordEmail],
        );

        if (existingEmailUser.rows.length > 0) {
          const linkedUser = await db.query(
            `UPDATE users
             SET discord_id = $1, provider = 'discord'
             WHERE id = $2
             RETURNING *`,
            [profile.id, existingEmailUser.rows[0].id],
          );
          return cb(null, linkedUser.rows[0]);
        }

        const newUserResult = await db.query(
          `INSERT INTO users (display_name, email, discord_id, provider)
           VALUES ($1, $2, $3, 'discord')
           RETURNING *`,
          [profile.username, discordEmail, profile.id],
        );

        return cb(null, newUserResult.rows[0]);
      } catch (err) {
        console.log(err);
        return cb(err);
      }
    },
  ),
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.use((err, req, res, next) => {
  console.log(err);

  if (err instanceof ErrorHandler) {
    if (err.message === "Validation failed") {
      req.session.formErrors = err.details;
      return res.redirect("/login");
    }
    if (err.details?.message === "Invalid password") {
      req.session.formErrors = err.details.message;
      return res.redirect("/login");
    }
    if (err.details?.message === "User not found") {
      req.session.formErrors = err.details.message;
      return res.redirect("/login");
    }
    if (err.message === "Registration failed") {
      req.session.formErrors = err.details;
      return res.redirect("/register");
    }
    if (err.message === "User already exists") {
      req.session.formErrors = err.details;
      return res.redirect("/register");
    }
    if (
      err.message === "Invalid post data" ||
      err.message === "Invalid reply data"
    ) {
      req.session.formErrors = err.details;
      return res.redirect("/forumpost");
    }
  }
  return res.status(500).send("Internal Server Error");
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;
