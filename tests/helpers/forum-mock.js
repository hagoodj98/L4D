import { vi } from "vitest";

export const dbState = {
  users: [],
  posts: [],
  replies: [],
  postReactions: [],
  commentReactions: [],
  nextUserId: 1,
  nextPostId: 1,
  nextReplyId: 1,
};

export function resetDbState() {
  dbState.users = [];
  dbState.posts = [];
  dbState.replies = [];
  dbState.postReactions = [];
  dbState.commentReactions = [];
  dbState.nextUserId = 1;
  dbState.nextPostId = 1;
  dbState.nextReplyId = 1;
}

function buildJoinRows() {
  return dbState.posts.map((postRow) => {
    const user = dbState.users.find((item) => item.id === postRow.user_id);
    return {
      ...user,
      ...postRow,
    };
  });
}

function buildForumRows(currentUserId, isAscSort) {
  const postOrder = [...dbState.posts].sort((a, b) => {
    const left = new Date(a.created_at).getTime();
    const right = new Date(b.created_at).getTime();
    return isAscSort ? left - right : right - left;
  });

  return postOrder.map((postRow) => {
    const postOwner = dbState.users.find((user) => user.id === postRow.user_id);

    const postLikeCount = dbState.postReactions.filter(
      (item) => item.post_id === postRow.id && item.reaction_type === "like",
    ).length;
    const postDislikeCount = dbState.postReactions.filter(
      (item) => item.post_id === postRow.id && item.reaction_type === "dislike",
    ).length;
    const postUserReaction =
      dbState.postReactions.find(
        (item) =>
          item.post_id === postRow.id && item.user_id === Number(currentUserId),
      )?.reaction_type || null;

    const replyRows = dbState.replies
      .filter((reply) => reply.post_id === postRow.id)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .map((reply) => {
        const replyOwner = dbState.users.find(
          (user) => user.id === reply.user_id,
        );
        const replyLikeCount = dbState.commentReactions.filter(
          (item) =>
            item.comment_id === reply.id && item.reaction_type === "like",
        ).length;
        const replyDislikeCount = dbState.commentReactions.filter(
          (item) =>
            item.comment_id === reply.id && item.reaction_type === "dislike",
        ).length;
        const replyUserReaction =
          dbState.commentReactions.find(
            (item) =>
              item.comment_id === reply.id &&
              item.user_id === Number(currentUserId),
          )?.reaction_type || null;

        return {
          id: reply.id,
          comment_post: reply.comment_post,
          user_id: reply.user_id,
          created_at: reply.created_at,
          likes: replyLikeCount,
          dislikes: replyDislikeCount,
          user_reaction: replyUserReaction,
          display_name: replyOwner?.display_name || null,
        };
      });

    return {
      id: postRow.id,
      updated_at: postRow.updated_at || null,
      post: postRow.post,
      user_id: postRow.user_id,
      created_at: postRow.created_at,
      likes: postLikeCount,
      dislikes: postDislikeCount,
      reply_count: replyRows.length,
      user_reaction: postUserReaction,
      display_name: postOwner?.display_name || null,
      replies: replyRows,
    };
  });
}

export function setupPgMock() {
  vi.doMock("pg", () => {
    class Client {
      async connect() {
        return true;
      }

      async query(sql, params = []) {
        if (sql.includes("SELECT * FROM users WHERE email = $1")) {
          return {
            rows: dbState.users.filter((user) => user.email === params[0]),
          };
        }

        if (
          sql.includes(
            "SELECT EXISTS (SELECT 1 FROM users WHERE email = $1 OR display_name = $2) AS user_exists",
          )
        ) {
          const foundUser = dbState.users.some(
            (user) =>
              user.email === params[0] || user.display_name === params[1],
          );
          return {
            rows: [{ user_exists: foundUser }],
          };
        }

        if (
          sql.includes(
            "INSERT INTO users (display_name, email, password) VALUES ($1, $2, $3) RETURNING *",
          )
        ) {
          const user = {
            id: dbState.nextUserId++,
            display_name: params[0],
            email: params[1],
            password: params[2],
          };
          dbState.users.push(user);
          return { rows: [user] };
        }

        if (sql.includes("SELECT * FROM users WHERE display_name = $1")) {
          return {
            rows: dbState.users.filter(
              (user) => user.display_name === params[0],
            ),
          };
        }

        if (sql.includes("SELECT * FROM users JOIN posts")) {
          if (sql.includes("WHERE user_id = $1")) {
            const userId = params[0];
            return {
              rows: buildJoinRows().filter((row) => row.user_id === userId),
            };
          }

          let rows = buildJoinRows();
          if (sql.includes("ORDER BY created_at DESC")) {
            rows = [...rows].sort(
              (a, b) => new Date(b.created_at) - new Date(a.created_at),
            );
          }
          if (sql.includes("ORDER BY created_at ASC")) {
            rows = [...rows].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at),
            );
          }

          return { rows };
        }

        if (
          sql.includes(
            "INSERT INTO posts (post, user_id, created_at) VALUES ($1, $2, $3)",
          )
        ) {
          const post = {
            id: dbState.nextPostId++,
            post: params[0],
            user_id: params[1],
            created_at: params[2],
          };
          dbState.posts.push(post);
          return { rows: [post] };
        }

        if (
          sql.includes(
            "INSERT INTO replies (comment_post, user_id, post_id, created_at) VALUES ($1, $2, $3, $4)",
          )
        ) {
          const reply = {
            id: dbState.nextReplyId++,
            comment_post: params[0],
            user_id: params[1],
            post_id: Number(params[2]),
            created_at: params[3],
          };
          dbState.replies.push(reply);
          return { rows: [reply] };
        }

        if (
          sql.includes("FROM posts p") &&
          sql.includes("COALESCE(rp.replies, '[]'::json) AS replies")
        ) {
          const currentUserId = params[0];
          const isAscSort = sql.includes("ORDER BY p.created_at ASC");
          const limit = Number(params[1]);
          const offset = Number(params[2]);
          const allRows = buildForumRows(currentUserId, isAscSort);

          return {
            rows:
              Number.isInteger(limit) && Number.isInteger(offset)
                ? allRows.slice(offset, offset + limit)
                : allRows,
          };
        }

        if (sql.includes("SELECT COUNT(*)") && sql.includes("FROM posts")) {
          return {
            rows: [
              {
                count: String(dbState.posts.length),
                total_posts: dbState.posts.length,
              },
            ],
          };
        }

        if (
          sql.includes(
            "SELECT reaction_type FROM reactions_comments WHERE comment_id = $1 AND user_id = $2",
          )
        ) {
          return {
            rows: dbState.commentReactions
              .filter(
                (item) =>
                  item.comment_id === Number(params[0]) &&
                  item.user_id === Number(params[1]),
              )
              .map((item) => ({ reaction_type: item.reaction_type })),
          };
        }

        if (
          sql.includes(
            "DELETE FROM reactions_comments WHERE comment_id = $1 AND user_id = $2",
          )
        ) {
          dbState.commentReactions = dbState.commentReactions.filter(
            (item) =>
              !(
                item.comment_id === Number(params[0]) &&
                item.user_id === Number(params[1])
              ),
          );
          return { rows: [] };
        }

        if (
          sql.includes(
            "INSERT INTO reactions_comments (comment_id, user_id, reaction_type)",
          )
        ) {
          const commentId = Number(params[0]);
          const userId = Number(params[1]);
          const reactionType = params[2];
          const existingIndex = dbState.commentReactions.findIndex(
            (item) => item.comment_id === commentId && item.user_id === userId,
          );

          if (existingIndex >= 0) {
            dbState.commentReactions[existingIndex].reaction_type =
              reactionType;
          } else {
            dbState.commentReactions.push({
              comment_id: commentId,
              user_id: userId,
              reaction_type: reactionType,
            });
          }

          return { rows: [] };
        }

        if (
          sql.includes(
            "SELECT reaction_type FROM posts_reactions WHERE post_id = $1 AND user_id = $2",
          )
        ) {
          return {
            rows: dbState.postReactions
              .filter(
                (item) =>
                  item.post_id === Number(params[0]) &&
                  item.user_id === Number(params[1]),
              )
              .map((item) => ({ reaction_type: item.reaction_type })),
          };
        }

        if (
          sql.includes(
            "DELETE FROM posts_reactions WHERE post_id = $1 AND user_id = $2",
          )
        ) {
          dbState.postReactions = dbState.postReactions.filter(
            (item) =>
              !(
                item.post_id === Number(params[0]) &&
                item.user_id === Number(params[1])
              ),
          );
          return { rows: [] };
        }

        if (
          sql.includes(
            "INSERT INTO posts_reactions (post_id, user_id, reaction_type)",
          )
        ) {
          const postId = Number(params[0]);
          const userId = Number(params[1]);
          const reactionType = params[2];
          const existingIndex = dbState.postReactions.findIndex(
            (item) => item.post_id === postId && item.user_id === userId,
          );

          if (existingIndex >= 0) {
            dbState.postReactions[existingIndex].reaction_type = reactionType;
          } else {
            dbState.postReactions.push({
              post_id: postId,
              user_id: userId,
              reaction_type: reactionType,
            });
          }

          return { rows: [] };
        }

        throw new Error(`Unhandled SQL in test mock: ${sql}`);
      }
    }

    return {
      default: {
        Client,
      },
    };
  });
}
