import express from "express";
import {
  addReaction as addPostReaction,
  removeReaction as removePostReaction,
  updateReaction as updatePostReaction,
  sameReaction as samePostReaction,
} from "../../database/repositories/posts_reactions.js";
import {
  addReaction as addCommentReaction,
  removeReaction as removeCommentReaction,
  sameReaction as sameCommentReaction,
  updateReaction as updateReactionComment,
} from "../../database/repositories/comments_reactions.js";
import {
  sameReaction as sameReplyReaction,
  addReaction as addReplyReaction,
  removeReaction as removeReplyReaction,
  updateReaction as updateReplyReaction,
} from "../../database/repositories/replies_reactions.js";
import { reactionSchema } from "../../utils/zodSchemas.js";
import ErrorHandler from "../../utils/error.js";

const router = express.Router();

router.post("/post-reaction", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/login");

  const rawData: {
    post_id?: number;
    comment_post_id?: number;
    final_reply_id?: number;
    comment_id?: number;
    reply_id?: number;
    reaction_type: string;
  } = await req.body;
  const { post_id, reaction_type } = rawData;

  const postId = post_id ? String(post_id) : null;

  const validation = reactionSchema.safeParse({
    post_id: postId,
    reaction_type: reaction_type,
  });

  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid reaction data", validation.error.issues),
    );
  }

  // Post reactions follow the same toggle behavior as reply reactions.
  const existing = await samePostReaction(postId, req.user.id);
  // If the same reaction exists, remove it. Otherwise, add or update to the new reaction.
  if (existing && existing.reaction_type === reaction_type) {
    await removePostReaction(postId, req.user.id);
    // Return the new reaction state to the client for immediate UI update.
    return res.json({
      reaction_intent: `remove`,
      reactionButton: `${existing.reaction_type}Button`,
      postType: `post`,
    });
  } else if (existing && existing.reaction_type !== reaction_type) {
    const reaction = await updatePostReaction(
      postId,
      req.user.id,
      reaction_type,
    );
    return res.json({
      reaction_intent: `update`,
      reactionButton: `${reaction.reaction_type}Button`,
      postType: `post`,
    });
  } else {
    const createdAt = new Date().toISOString();
    const reaction = await addPostReaction(
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
});
router.post("/comment-reaction", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/login");

  const rawData: {
    comment_id?: number;
    reaction_type: string;
  } = await req.body;
  const { comment_id, reaction_type } = rawData;

  const commentId = comment_id ? String(comment_id) : null;
  const validation = reactionSchema.safeParse({
    comment_id: commentId,
    reaction_type: reaction_type,
  });

  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid reaction data", validation.error.issues),
    );
  }
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
    const createdAt = new Date().toISOString();
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
});
router.post("/reply-reaction", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/login");

  const rawData: {
    reply_id?: number;
    reaction_type: string;
  } = await req.body;
  const { reply_id, reaction_type } = rawData;

  const replyID = reply_id ? String(reply_id) : null;
  const validation = reactionSchema.safeParse({
    reply_id: replyID,
    reaction_type: reaction_type,
  });

  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid reaction data", validation.error.issues),
    );
  }
  // Final reply reactions toggle: same reaction removes, different reaction upserts.
  const existing = await sameReplyReaction(replyID, req.user.id);
  if (existing && existing.reaction_type === reaction_type) {
    await removeReplyReaction(replyID, req.user.id);
    return res.json({
      reaction_intent: `remove`,
      reactionButton: `${existing.reaction_type}Button`,
      postType: `reply`,
    });
  } else if (existing && existing.reaction_type !== reaction_type) {
    const reaction = await updateReplyReaction(
      replyID,
      req.user.id,
      reaction_type,
    );
    return res.json({
      reaction_intent: `update`,
      reactionButton: `${reaction.reaction_type}Button`,
      postType: `reply`,
    });
  } else {
    const createdAt = new Date().toISOString();
    const reaction = await addReplyReaction(
      replyID,
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
});
export default router;
