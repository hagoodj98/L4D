import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import passport from "./passport/passport.js";
import session from "express-session";

import {
  registrationSchema,
  loginSchema,
  reactionSchema,
  postSchema,
  replySchema,
  sortSchema,
} from "./utils/zodSchemas.js";
import {
  getForumPosts,
  totalPostsResult,
  createPost,
} from "./database/repositories/posts.js";
import {
  checkingIfExisting,
  createUser,
} from "./database/repositories/users.js";
import {
  addReaction,
  removeReaction,
  existing as existingPostReaction,
} from "./database/repositories/posts_reactions.js";
import {
  addReaction as addCommentReaction,
  removeReaction as removeCommentReaction,
  existing as existingCommentReaction,
} from "./database/repositories/reactions_comments.js";
import { createReply } from "./database/repositories/replies.js";
import ErrorHandler from "./utils/error.js";

const app = express();

const port = 3000;

const saltRounds = 10;
const isProduction = process.env.NODE_ENV === "production";

app.use(
  session({
    name: "zombieslayers.sid",
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    },
    secret: process.env.SESSION_SECRET || "test-session-secret",
    resave: false,
    saveUninitialized: false,
    rolling: true,
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
const isUserAuthenticated = (req, res, page) => {
  if (!req.isAuthenticated()) return res.render(`${page}.ejs`);
  res.render(`${page}.ejs`, {
    currentUser: req.user.display_name,
  });
};

app.get("/", (req, res) => {
  isUserAuthenticated(req, res, "index");
});
app.get("/survivors", (req, res) => {
  isUserAuthenticated(req, res, "survivors");
});
app.get("/specialinfected", (req, res) => {
  isUserAuthenticated(req, res, "specialinfected");
});
app.get("/community", (req, res) => {
  isUserAuthenticated(req, res, "community");
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

  const getTotalPosts = await totalPostsResult();
  const totalPosts = getTotalPosts.rows[0].count;
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
    const userExists = await checkingIfExisting(email, username);
    if (userExists) {
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
          const user = await createUser(username, email, hash);
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
    const existing = await existingCommentReaction(commentId, req.user.id);

    if (existing && existing.reaction_type === reaction) {
      await removeCommentReaction(commentId, req.user.id);
    } else {
      //if insert hits a duplicate on this unique key… ON CONFLICT
      //…update existing row instead of throwing error DO UPDATE
      //the row you tried to insert (the “new incoming values”) are referenced as EXCLUDED in the DO UPDATE clause
      await addCommentReaction(commentId, req.user.id, reaction);
    }
    return res.redirect("/forum");
  }

  if (postId) {
    // POST path: only touch posts_reactions
    const existing = await existingPostReaction(postId, req.user.id);

    if (existing && existing.reaction_type === reaction) {
      await removeReaction(postId, req.user.id);
    } else {
      await addReaction(postId, req.user.id, reaction);
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
  if (!req.isAuthenticated()) return res.redirect("/login");

  const post = req.body.newPost;

  const validation = postSchema.safeParse({ newPost: post });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid post data", validation.error.issues),
    );
  }

  try {
    await createPost(post, req.user.id);
    res.redirect("/forum");
  } catch (err) {
    return next(new ErrorHandler(500, "Internal Server Error", err));
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

  try {
    await createReply(comment_post, req.user.id, post_id);
    res.redirect("/forum");
  } catch (err) {
    return next(new ErrorHandler(500, "Internal Server Error", err));
  }
});

app.use((err, req, res, _next) => {
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
  app.listen(port);
}

export default app;
