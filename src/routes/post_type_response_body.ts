import express from "express";
import { createComment } from "../../database/repositories/comments.js";
import { createReply } from "../../database/repositories/replies.js";
import { createPost } from "../../database/repositories/posts.js";
import { postSchema, replySchema } from "../../utils/zodSchemas.js";
import ErrorHandler from "../../utils/error.js";
import type { CommentMeta, PostMeta, ReplyMeta } from "../../types/types.js";
const router = express.Router();

router.post("/add-post", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/auth/login");

  const post = req.body.newPost;

  const validation = postSchema.safeParse({ newPost: post });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid post data", validation.error.issues),
    );
  }
  const currentPage = String(req.body.current_page);
  try {
    const createdAt = new Date().toISOString();
    let result = await createPost(post, req.user.id, createdAt, currentPage);
    const postMetaBody: PostMeta = {
      type: "post",
      id: result.id,
      ...result,
    };

    return res.json({ success: true, postMetaData: postMetaBody });
  } catch (err) {
    return next(new ErrorHandler(500, "Internal Server Error", err));
  }
});
router.post("/add-comment", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/auth/login");

  const postId = req.body.post_id ? String(req.body.post_id) : null;
  const commentPost = req.body.comment_post
    ? String(req.body.comment_post)
    : null;
  const validation = replySchema.safeParse({
    reply: commentPost,
    post_id: postId,
  });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid comment data", validation.error.issues),
    );
  }
  const currentPage = String(req.body.current_page);

  try {
    const creationTime = new Date().toISOString();
    let result = await createComment(
      commentPost,
      req.user.id,
      postId,
      creationTime,
      currentPage,
    );
    const commentMetaBody: CommentMeta = {
      type: "comment",
      id: result.id,
      ...result,
    };

    return res.json({ success: true, commentMetaData: commentMetaBody });
  } catch (err) {
    return next(new ErrorHandler(500, "Internal Server Error", err));
  }
});
router.post("/add-reply", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/auth/login");

  const commentID = String(req.body.comment_id ?? req.body.reply_id);
  const replyPost = String(req.body.reply_post ?? req.body.comment_post);

  const validation = replySchema.safeParse({
    reply: replyPost,
    comment_id: commentID,
  });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid reply data", validation.error.issues),
    );
  }
  const currentPage = String(req.body.current_page);
  try {
    const createdAt = new Date().toISOString();
    let result = await createReply(
      replyPost,
      req.user.id,
      commentID,
      createdAt,
      currentPage,
    );

    const replyMetaBody: ReplyMeta = {
      type: "reply",
      id: result.id,
      ...result,
    };

    return res.json({
      success: true,
      replyMetaData: replyMetaBody,
      subReply: true,
    });
  } catch (err) {
    return next(new ErrorHandler(500, "Internal Server Error", err));
  }
});
export default router;
