import express from "express";
import {
  getAllForumData,
  totalPostsResult,
} from "../../database/repositories/forumcontent.js";
import ErrorHandler from "../../utils/error.js";
import { sortSchema } from "../../utils/zodSchemas.js";
import { NotificationSource } from "../../types/types.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  const validation = sortSchema.safeParse({ sortDirection: "DESC" });
  if (!validation.success) {
    return res.status(400).send("Invalid sort direction");
  }
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 4;
  const offset = req.query.page
    ? (parseInt(req.query.page as string) - 1) * limit
    : 0;
  try {
    let content: NotificationSource[] = await getAllForumData(
      req.user ? req.user.id : null,
      "DESC",
      limit,
      offset,
    );

    const totalPosts: string = await totalPostsResult();
    const paginationNumber = Math.ceil(Number(totalPosts) / 4);
    return res.render("forum.ejs", {
      currentUser: req.user ? req.user.display_name : "Guest",
      isAuthenticated: req.isAuthenticated(),
      listAllContent: content,
      paginationNumber,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
    });
  } catch (err) {
    return next(new ErrorHandler(500, "Internal Server Error", err));
  }
});
router.get("/total-posts", async (req, res, next) => {
  try {
    const totalPosts: string = await totalPostsResult();
    const paginationNumber = Math.ceil(Number(totalPosts) / 4);
    return res.json({ totalPosts, paginationNumber });
  } catch (err) {
    return next(new ErrorHandler(500, "Internal Server Error", err));
  }
});
router.get("/pagination", async (req, res, next) => {
  const validation = sortSchema.safeParse({ sortDirection: "DESC" });
  if (!validation.success) {
    return res.status(400).send("Invalid sort direction");
  }
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 4;
  const offset = req.query.page
    ? (parseInt(req.query.page as string) - 1) * limit
    : 0;
  try {
    let result: NotificationSource[] = await getAllForumData(
      req.user ? req.user.id : null,
      "DESC",
      limit,
      offset,
    );

    return res.json({ listAllContent: result });
  } catch (err) {
    return next(new ErrorHandler(500, "Internal Server Error", err));
  }
});

router.get("/ascend", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/auth/login");
  const validation = sortSchema.safeParse({ sortDirection: "DESC" });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid sort direction", validation.error.issues),
    );
  }
  const result = await getAllForumData(req.user.id, "DESC");
  const getTotalPosts = await totalPostsResult();
  return res.json({
    listAllContent: result,
    totalPosts: getTotalPosts,
  });
});
router.get("/descend", async (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect("/auth/login");
  const validation = sortSchema.safeParse({ sortDirection: "ASC" });
  if (!validation.success) {
    return next(
      new ErrorHandler(400, "Invalid sort direction", validation.error.issues),
    );
  }
  const content = await getAllForumData(req.user.id, "ASC");
  const totalPosts = await totalPostsResult();
  return res.json({
    listAllContent: content,
    totalPosts,
  });
});

export default router;
