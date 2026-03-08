import { z } from "zod";

export const registrationSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});
export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});
export const reactionSchema = z.object({
  post_id: z.string().optional(),
  comment_post_id: z.string().optional(),
  reaction: z.enum(["like", "dislike"]).optional(),
  reaction_comment: z.enum(["like", "dislike"]).optional(),
});
export const postSchema = z.object({
  newPost: z.string().min(1, "Post content cannot be empty"),
});
export const replySchema = z.object({
  reply: z.string().min(1, "Reply content cannot be empty"),
  post_id: z.string().min(1, "Post ID is required for a reply"),
});
export const sortSchema = z.object({
  sortDirection: z.enum(["ASC", "DESC"]),
});
