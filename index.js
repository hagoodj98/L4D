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
  getAllForumData,
  totalPostsResult,
  createPost,
} from "./database/repositories/forumcontent.js";
import {
  checkingIfExisting,
  createUser,
} from "./database/repositories/users.js";
import {
  addReaction,
  removeReaction,
  updateReaction,
  sameReaction as samePostReaction,
} from "./database/repositories/posts_reactions.js";
import {
  addReaction as addCommentReaction,
  removeReaction as removeCommentReaction,
  sameReaction as sameCommentReaction,
  updateReaction as updateReactionComment,
} from "./database/repositories/comments_reactions.js";
import { createComment } from "./database/repositories/comments.js";
import { createReply } from "./database/repositories/replies.js";
import {
  sameReaction as sameReplyReaction,
  addReaction as addReplyReaction,
  removeReaction as removeReplyReaction,
  updateReaction as updateReplyReaction,
} from "./database/repositories/replies_reactions.js";
import ErrorHandler from "./utils/error.js";
import { fetchAllNotifications } from "./database/repositories/user_notifications.js";
import { getAllSourcedNotifications as mergeAllSourcedNotifications } from "./utils/notififcationHelper.js";
import {
  getNotificationState,
  saveNotifcationState,
} from "./database/repositories/user_notifications.js";

const app = express();

const port = 3000;

const cachedUserNotificationState = new Map(); // Map to store notification states for each user

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
// Initialize Passport and restore authentication state from the session on each request.
app.use(passport.initialize());
app.use(passport.session());
// Shared view locals for navbar/account UI across all pages.
app.use(async (req, res, next) => {
  res.locals.user = req.user ? req.user.display_name : null;
  if (req.user) {
    // Check if the user's notification state is already cached. If not, fetch it from the database and cache it.
    if (!cachedUserNotificationState.has(req.user.id)) {
      const cachedNotificationsState = await getNotificationState(req.user.id);
      if (cachedNotificationsState?.notification_state?.notifications) {
        cachedUserNotificationState.set(
          req.user.id,
          cachedNotificationsState.notification_state.notifications,
        );
      }
    }
    // Retrieve the cached notification state for the authenticated user, if available.
    const cachedNotifications =
      cachedUserNotificationState.get(req.user.id) ?? [];
    // If there are cached notifications, use them to avoid unnecessary database queries.
    if (cachedNotifications.length > 0) {
      res.locals.notificationState = cachedNotifications;
      res.locals.currentPath = req.path;
      return next(); // Use the cached state and skip fetching from the database
    }
    // Fetch notifications for posts, comments, and replies for the authenticated user from the database.
    const { postsNotifications, commentsNotifications, repliesNotifications } =
      await fetchAllNotifications(req.user.id);
    // Merge all notifications into a single array for the authenticated user.
    let allSourcedNotifications = [
      ...postsNotifications,
      ...commentsNotifications,
      ...repliesNotifications,
    ];
    // Process and merge all sourced notifications with the cached notifications.
    const IndividualNotifications = await mergeAllSourcedNotifications(
      allSourcedNotifications,
      cachedNotifications,
    );
    // Mark all individual notifications as unread before saving to the database.
    const notificationMarkedUnread = IndividualNotifications.map(
      (notification) => ({
        id: crypto.randomUUID(),
        ...notification,
        wasRead: false,
      }),
    );
    // Save the updated notification state to the database.
    const getNotificationsState = await saveNotifcationState(
      req.user.id,
      notificationMarkedUnread,
    );
    // Retrieve the updated notification state from the database response.
    const notifications =
      getNotificationsState[0].notification_state.notifications;
    cachedUserNotificationState.set(req.user.id, notifications);
    // Cache the updated notification state for the authenticated user.
    console.log(`Authenticated user: ${req.user.display_name}`);
    res.locals.notificationState = notifications;
  }
  // Store the current path for active nav link highlighting.
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

app.get("/check-notifications-reloaded", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  const userId = req.user.id;
  const userNotifications = cachedUserNotificationState.get(userId) || [];

  return res.json({
    notifications: userNotifications,
    wasNotificationRead: userNotifications.wasRead,
  });
});
app.post("/read-notifications", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  // Update the notifications_read column for the authenticated user.
  const userId = req.user.id;
  const userNotifications = cachedUserNotificationState.get(userId) ?? [];

  const convertNotificationsToRead = userNotifications.map((notification) => {
    if (notification.wasRead === false) {
      notification.wasRead = true;
    }
    return notification;
  });
  //save the updated notification state to the database
  const notificationsRead = await saveNotifcationState(
    userId,
    convertNotificationsToRead,
  );
  // Update the cached notification state with the latest data from the database
  cachedUserNotificationState.set(
    userId,
    notificationsRead[0].notification_state.notifications,
  );
  res.sendStatus(200);
});
app.get("/update-notifications", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  // Set headers for SSE (Server-Sent Events)
  res.setHeader("Content-Type", "text/event-stream"); // Set headers for SSE (Server-Sent Events)
  res.setHeader("Cache-Control", "no-cache"); // Disable caching
  res.setHeader("Connection", "keep-alive"); // Keep the connection open

  // Keep the connection open for future updates
  const intervalId = setInterval(async () => {
    const userId = req.user.id;
    const getUserNotification = cachedUserNotificationState.get(userId) || [];
    const cachedNotifications = getUserNotification ?? [];
    //check to see if there are new notifications for the user by pulling from database
    const { postsNotifications, commentsNotifications, repliesNotifications } =
      await fetchAllNotifications(userId);
    let allSourcedNotifications = [
      ...postsNotifications,
      ...commentsNotifications,
      ...repliesNotifications,
    ];
    const IndividualNotifications = await mergeAllSourcedNotifications(
      allSourcedNotifications,
    );
    //at this point, the cache is the only aspect with an id. the individual notifications from the database may not have an id yet. So we need to map the id's from the cache if certain keys match.
    const mapNotificationsById = IndividualNotifications?.map(
      (notification) => {
        const cachedNotification = cachedNotifications.find((cacheN) => {
          const notificationTypeMatch =
            cacheN.notification_type === notification.notification_type;
          const postType = cacheN.post
            ? cacheN.post === notification.post
            : cacheN.comment_post
              ? cacheN.comment_post === notification.comment_post
              : cacheN.reply_post
                ? cacheN.reply_post === notification.reply_post
                : null;
          const idMatch = cacheN.post_id
            ? cacheN.post_id === notification.post_id
            : cacheN.comment_id
              ? cacheN.comment_id === notification.comment_id
              : cacheN.reply_id
                ? cacheN.reply_id === notification.reply_id
                : null;
          const reactionTypeMatch =
            cacheN.reaction_type === notification.reaction_type;
          const createdAtMatch = cacheN.created_at === notification.created_at;
          const userMatch = cacheN.user_name === notification.user_name;
          // Check if the cached notification matches the current notification based on various criteria.
          if (
            idMatch &&
            notificationTypeMatch &&
            postType &&
            reactionTypeMatch &&
            createdAtMatch &&
            userMatch
          ) {
            return {
              id: cacheN.id,
              ...notification,
            };
          }
        });
        // If no matching cached notification is found, create a new notification with a unique ID and mark it as unread.
        return (
          cachedNotification ?? {
            id: crypto.randomUUID(),
            ...notification,
            wasRead: false,
          }
        );
      },
    );

    const areAllNotificationsRead = mapNotificationsById.every(
      (notification) => notification.wasRead,
    );
    //if none of the notifications are read, including any new notifications, send the count to the client
    if (!areAllNotificationsRead) {
      let payload = {};
      //we want to check if all notifications aren't read before we determine how many the other individual notifications are unread
      const allAreUnread = mapNotificationsById.filter(
        (notification) => !notification.wasRead,
      ).length;
      // If all notifications are unread, send the count to the client immediately.
      if (allAreUnread === mapNotificationsById.length) {
        payload = {
          count: allAreUnread,
          notifications: mapNotificationsById,
        };
        res.write(`data: ${JSON.stringify({ payload })}\n\n`);
        return;
      }
      //select the few marked as unread
      const fewAreUnread = mapNotificationsById.filter(
        (notification) => !notification.wasRead,
      );
      // Save the updated notification state to the database because we are pulling from database and need to make sure we save this state in the users table. At this point in the code, there was something added to the notifications array that needs to be persisted. As a result, we call the function to save the current state.
      await saveNotifcationState(userId, mapNotificationsById);
      //save to cache
      cachedUserNotificationState.set(userId, mapNotificationsById);
      // If only a few notifications are unread, send the count to the client.
      if (fewAreUnread.length > 0) {
        payload = {
          count: fewAreUnread.length,
          notifications: mapNotificationsById,
        };
      }
      res.write(`data: ${JSON.stringify({ payload })}\n\n`);
      return;
    } else {
      // If all notifications are read, do nothing and return early.
      return;
    }
  }, 5000); // Send updates every 5 seconds

  // Clean up when the client disconnects
  req.on("close", () => {
    clearInterval(intervalId);
    res.end();
  });
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
    const result = await getAllForumData(
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
    const result = await getAllForumData(
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
  const result = await getAllForumData(req.user.id, "DESC");
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
  const result = await getAllForumData(req.user.id, "ASC");
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
  const { post_id, comment_post_id, reaction_type, final_reply_id } = rawData;

  const postId = post_id ? String(post_id) : null;
  const commentId = comment_post_id ? String(comment_post_id) : null;
  const finalReplyId = final_reply_id ? String(final_reply_id) : null;
  const validation = reactionSchema.safeParse({
    post_id: postId,
    comment_post_id: commentId,
    final_reply_id: finalReplyId,
    reaction_type: reaction_type,
  });

  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid reaction data", validation.error.issues),
    );
  }

  if (finalReplyId) {
    // Final reply reactions toggle: same reaction removes, different reaction upserts.
    const existing = await sameReplyReaction(finalReplyId, req.user.id);

    if (existing && existing.reaction_type === reaction_type) {
      await removeReplyReaction(finalReplyId, req.user.id);
      return res.json({
        reaction_intent: `remove`,
        reactionButton: `${existing.reaction_type}Button`,
        postType: `reply`,
      });
    } else if (existing && existing.reaction_type !== reaction_type) {
      const reaction = await updateReplyReaction(
        finalReplyId,
        req.user.id,
        reaction_type,
      );
      return res.json({
        reaction_intent: `update`,
        reactionButton: `${reaction.reaction_type}Button`,
        postType: `reply`,
      });
    } else {
      const createdAt = new Date();
      const reaction = await addReplyReaction(
        finalReplyId,
        req.user.id,
        reaction_type,
        createdAt,
      );
      return res.json({
        reaction_intent: `add`,
        reactionButton: `${reaction.reaction_type}Button`,
        postType: `reply`,
      });
    }
  } else if (commentId) {
    // Comment reactions toggle: same reaction removes, different reaction upserts.
    const existing = await sameCommentReaction(commentId, req.user.id);

    if (existing && existing.reaction_type === reaction_type) {
      await removeCommentReaction(commentId, req.user.id);
      return res.json({
        reaction_intent: `remove`,
        reactionButton: `${existing.reaction_type}Button`,
        postType: `comment`,
      });
    } else if (existing && existing.reaction_type !== reaction_type) {
      const reaction = await updateReactionComment(
        commentId,
        req.user.id,
        reaction_type,
      );
      return res.json({
        reaction_intent: `update`,
        reactionButton: `${reaction.reaction_type}Button`,
        postType: `comment`,
      });
    } else {
      const createdAt = new Date();
      const reaction = await addCommentReaction(
        commentId,
        req.user.id,
        reaction_type,
        createdAt,
      );
      return res.json({
        reaction_intent: `add`,
        reactionButton: `${reaction.reaction_type}Button`,
        postType: `comment`,
      });
    }
  } else {
    // Post reactions follow the same toggle behavior as reply reactions.
    const existing = await samePostReaction(postId, req.user.id);
    // If the same reaction exists, remove it. Otherwise, add or update to the new reaction.
    if (existing && existing.reaction_type === reaction_type) {
      await removeReaction(postId, req.user.id);
      // Return the new reaction state to the client for immediate UI update.
      return res.json({
        reaction_intent: `remove`,
        reactionButton: `${existing.reaction_type}Button`,
        postType: `post`,
      });
    } else if (existing && existing.reaction_type !== reaction_type) {
      const reaction = await updateReaction(postId, req.user.id, reaction_type);
      return res.json({
        reaction_intent: `update`,
        reactionButton: `${reaction.reaction_type}Button`,
        postType: `post`,
      });
    } else {
      const createdAt = new Date();
      const reaction = await addReaction(
        postId,
        req.user.id,
        reaction_type,
        createdAt,
      );
      return res.json({
        reaction_intent: `add`,
        reactionButton: `${reaction.reaction_type}Button`,
        postType: `post`,
      });
    }
  }
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

  const postId = req.body.post_id ? String(req.body.post_id) : null;
  const replyId = req.body.reply_id ? String(req.body.reply_id) : null;
  const comment_post = req.body.comment_post
    ? String(req.body.comment_post)
    : null;
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
      const result = await createComment(comment_post, req.user.id, postId);
      return res.json({ success: true, reply: result });
    }
    const result = await createReply(comment_post, req.user.id, replyId);
    return res.json({ success: true, reply: result, subReply: true });
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
