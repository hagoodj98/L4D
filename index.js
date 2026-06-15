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
  updateReaction,
  existing as existingPostReaction,
} from "./database/repositories/posts_reactions.js";
import {
  addReaction as addCommentReaction,
  removeReaction as removeCommentReaction,
  existing as existingCommentReaction,
  updateReaction as updateReactionComment,
} from "./database/repositories/reactions_comments.js";
import { createReply } from "./database/repositories/replies.js";
import { createReply as createSubReply } from "./database/repositories/sub_replies.js";
import ErrorHandler from "./utils/error.js";
import z from "zod";

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
    // Refresh cookie expiry on each request while a user is active.
    rolling: true,
  }),
);
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());
// Shared view locals for navbar/account UI across all pages.
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

app.get("/forum", async (req, res, next) => {
  const validation = sortSchema.safeParse({ sortDirection: "DESC" });
  if (!validation.success) {
    return res.status(400).send("Invalid sort direction");
  }
  const limit = req.query.limit ? parseInt(req.query.limit) : 4;
  const offset = req.query.page ? (parseInt(req.query.page) - 1) * limit : 0;
  try {
    const result = await getForumPosts(
      req.user ? req.user.id : null,
      "DESC",
      limit,
      offset,
    );

    const getTotalPosts = await totalPostsResult();
    const totalPosts = getTotalPosts.rows[0].count;
    return res.render("forum.ejs", {
      currentUser: req.user ? req.user.display_name : "Guest",
      isAuthenticated: req.isAuthenticated(),
      listAllContent: result.rows,
      totalPosts,
    });
  } catch (err) {
    return next(new ErrorHandler(500, "Internal Server Error", err));
  }
});
app.get("/forumpagination", async (req, res, next) => {
  const validation = sortSchema.safeParse({ sortDirection: "DESC" });
  if (!validation.success) {
    return res.status(400).send("Invalid sort direction");
  }
  const limit = req.query.limit ? parseInt(req.query.limit) : 4;
  const offset = req.query.page ? (parseInt(req.query.page) - 1) * limit : 0;
  try {
    const result = await getForumPosts(
      req.user ? req.user.id : null,
      "DESC",
      limit,
      offset,
    );
    return res.json({ listAllContent: result.rows });
  } catch (err) {
    return next(new ErrorHandler(500, "Internal Server Error", err));
  }
});
app.post("/login", async (req, res, next) => {
  // Keep local auth result handling in this route so form-specific errors
  // can be normalized into the central error middleware.
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
      // Hash password before persistence, then create a logged-in session.
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

app.get("/ascend", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/login");
  const validation = sortSchema.safeParse({ sortDirection: "DESC" });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid sort direction", validation.error.issues),
    );
  }
  const result = await getForumPosts(req.user.id, "DESC");
  const getTotalPosts = await totalPostsResult();
  const totalPosts = getTotalPosts.rows[0].count;
  return res.json({
    listAllContent: result.rows,
    totalPosts,
  });
});
app.get("/descend", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/login");
  const validation = sortSchema.safeParse({ sortDirection: "ASC" });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid sort direction", validation.error.issues),
    );
  }
  const result = await getForumPosts(req.user.id, "ASC");
  const getTotalPosts = await totalPostsResult();
  const totalPosts = getTotalPosts.rows[0].count;
  return res.json({
    listAllContent: result.rows,
    totalPosts,
  });
});

app.post("/post-reaction", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/login");

  const rawData = await req.body;
  const { post_id, comment_post_id, reaction_type } = rawData;

  const postId = post_id ? String(post_id) : null;
  const commentId = comment_post_id ? String(comment_post_id) : null;
  const validation = reactionSchema.safeParse({
    post_id: postId,
    comment_post_id: commentId,
    reaction_type: reaction_type,
  });

  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid reaction data", validation.error.issues),
    );
  }

  if (commentId) {
    // Reply reactions toggle: same reaction removes, different reaction upserts.
    const existing = await existingCommentReaction(commentId, req.user.id);

    if (existing && existing.reaction_type === reaction_type) {
      await removeCommentReaction(commentId, req.user.id);
      return res.json({
        reaction_type: `${existing.reaction_type}_removed_comment`,
      });
    } else if (existing && existing.reaction_type !== reaction_type) {
      const reaction = await updateReactionComment(
        commentId,
        req.user.id,
        reaction_type,
      );
      return res.json({
        reaction_type: `${reaction.reaction_type}_updated_comment`,
      });
    } else {
      const reaction = await addCommentReaction(
        commentId,
        req.user.id,
        reaction_type,
      );
      return res.json({ reaction_type: `${reaction.reaction_type}_comment` });
    }
  }

  if (postId) {
    // Post reactions follow the same toggle behavior as reply reactions.
    const existing = await existingPostReaction(postId, req.user.id);
    // If the same reaction exists, remove it. Otherwise, add or update to the new reaction.
    if (existing && existing.reaction_type === reaction_type) {
      await removeReaction(postId, req.user.id);
      // Return the new reaction state to the client for immediate UI update.
      return res.json({ reaction_type: `${existing.reaction_type}_removed` });
    } else if (existing && existing.reaction_type !== reaction_type) {
      const reaction = await updateReaction(postId, req.user.id, reaction_type);
      return res.json({ reaction_type: `${reaction.reaction_type}_updated` });
    } else {
      const reaction = await addReaction(postId, req.user.id, reaction_type);
      return res.json({ reaction_type: reaction.reaction_type });
    }
  }

  return res.status(400).send("Missing reaction target");
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
    const result = await createPost(post, req.user.id);
    return res.json({ success: true, post: result });
  } catch (err) {
    return next(new ErrorHandler(500, "Internal Server Error", err));
  }
});
app.post("/add-reply", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/login");

  const comment_post = req.body.comment_post;
  const postId = String(req.body.post_id);
  const replyId = String(req.body.reply_id);
  const validation = replySchema.safeParse({
    reply: comment_post,
    post_id: postId,
    reply_id: replyId,
  });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid reply data", validation.error.issues),
    );
  }

  try {
    if (!replyId) {
      const result = await createReply(comment_post, req.user.id, postId);
      return res.json({ success: true, reply: result });
    }
    const result = await createSubReply(comment_post, req.user.id, replyId);
    return res.json({ success: true, reply: result });
  } catch (err) {
    return next(new ErrorHandler(500, "Internal Server Error", err));
  }
});

app.use((err, req, res, _next) => {
  // Convert structured domain errors into user-facing redirects/messages.
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
  console.error(err);

  return res.status(500).send("Internal Server Error");
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port);
  console.log(`app listening on port, ${port}`);
}

export default app;
