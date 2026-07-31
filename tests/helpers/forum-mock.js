import { vi } from "vitest";

export const dbState = {
  users: [],
  posts: [],
  replies: [],
  repliesFinalTier: [],
  postReactions: [],
  commentReactions: [],
  finalReplyReactions: [],
  pendingNotificationState: [],
  nextUserId: 1,
  nextPostId: 1,
  nextReplyId: 1,
  nextFinalReplyId: 1,
};

export function resetDbState() {
  dbState.users = [];
  dbState.posts = [];
  dbState.replies = [];
  dbState.repliesFinalTier = [];
  dbState.postReactions = [];
  dbState.commentReactions = [];
  dbState.finalReplyReactions = [];
  dbState.pendingNotificationState = [];
  dbState.nextUserId = 1;
  dbState.nextPostId = 1;
  dbState.nextReplyId = 1;
  dbState.nextFinalReplyId = 1;
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

        const finalReplyRows = dbState.repliesFinalTier
          .filter((finalReply) => finalReply.reply_id === reply.id)
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          )
          .map((finalReply) => {
            const finalReplyOwner = dbState.users.find(
              (user) => user.id === finalReply.user_id,
            );
            const finalReplyLikeCount = dbState.finalReplyReactions.filter(
              (item) =>
                item.reply_id === finalReply.id &&
                item.reaction_type === "like",
            ).length;
            const finalReplyDislikeCount = dbState.finalReplyReactions.filter(
              (item) =>
                item.reply_id === finalReply.id &&
                item.reaction_type === "dislike",
            ).length;
            const finalReplyUserReaction =
              dbState.finalReplyReactions.find(
                (item) =>
                  item.reply_id === finalReply.id &&
                  item.user_id === Number(currentUserId),
              )?.reaction_type || null;

            return {
              id: finalReply.id,
              user_id: finalReply.user_id,
              comment_post: finalReply.comment_post,
              created_at: finalReply.created_at,
              likes: finalReplyLikeCount,
              dislikes: finalReplyDislikeCount,
              current_user_reaction: finalReplyUserReaction,
              display_name: finalReplyOwner?.display_name || null,
            };
          });

        return {
          id: reply.id,
          comment_post: reply.comment_post,
          user_id: reply.user_id,
          created_at: reply.created_at,
          likes: replyLikeCount,
          dislikes: replyDislikeCount,
          user_reaction: replyUserReaction,
          display_name: replyOwner?.display_name || null,
          reply_count: finalReplyRows.length,
          replies_final_tier: finalReplyRows,
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
        const normalizedSql = String(sql).replace(/\s+/g, " ").trim();

        if (normalizedSql.includes("SELECT * FROM users WHERE email = $1")) {
          return {
            rows: dbState.users.filter((user) => user.email === params[0]),
          };
        }

        if (
          normalizedSql.includes("SELECT EXISTS (") &&
          normalizedSql.includes(
            "FROM users WHERE email = $1 OR display_name = $2",
          ) &&
          normalizedSql.includes(") AS user_exists")
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
          normalizedSql.includes(
            "INSERT INTO users (display_name, email, password)",
          ) &&
          normalizedSql.includes("VALUES ($1, $2, $3)") &&
          normalizedSql.includes("RETURNING *")
        ) {
          const user = {
            id: dbState.nextUserId++,
            display_name: params[0],
            email: params[1],
            password: params[2],
            notification_state: {
              notifications: [...dbState.pendingNotificationState],
            },
          };
          dbState.users.push(user);
          return { rows: [user] };
        }

        if (
          normalizedSql.includes("'posts_down' AS notification_type") &&
          normalizedSql.includes("likes_to_posts") &&
          normalizedSql.includes("other_comments_to_posts")
        ) {
          if (dbState.pendingNotificationState.length === 0) {
            return { rows: [] };
          }

          const reactionsToPosts = dbState.pendingNotificationState.map(
            (notification) => ({
              user_name: notification.user_name,
              reaction_type: notification.reaction_type,
              created_at: notification.created_at,
              post_id: notification.post_id,
              post: notification.source_post ?? "mock post",
              source_post: notification.source_post ?? "mock post",
              notification_type: "posts_down",
              on_page: notification.on_page ?? "1/1",
            }),
          );

          return {
            rows: [
              {
                id: 1,
                post: "mock post",
                notification_type: "posts_down",
                reactions_to_posts: reactionsToPosts,
                other_comments: [],
              },
            ],
          };
        }

        if (
          normalizedSql.includes("'comments_down' AS notification_type") &&
          normalizedSql.includes("likes_to_comments") &&
          normalizedSql.includes("other_replies_to_comments")
        ) {
          return { rows: [] };
        }

        if (
          normalizedSql.includes("'replies_down' AS notification_type") &&
          normalizedSql.includes("likes_to_replies")
        ) {
          return { rows: [] };
        }

        if (
          normalizedSql.includes(
            "SELECT notification_state FROM users WHERE id = $1",
          )
        ) {
          const user = dbState.users.find(
            (item) => item.id === Number(params[0]),
          );
          return {
            rows: user
              ? [
                  {
                    notification_state: user.notification_state ?? {
                      notifications: [],
                    },
                  },
                ]
              : [],
          };
        }

        if (
          normalizedSql.includes("UPDATE users") &&
          normalizedSql.includes("SET notification_state=jsonb_set")
        ) {
          const userId = Number(params[0]);
          const notifications = JSON.parse(params[1]);
          const user = dbState.users.find((item) => item.id === userId);

          if (user) {
            user.notification_state = {
              ...(user.notification_state ?? {}),
              notifications,
            };
          }

          return {
            rows: user ? [{ notification_state: user.notification_state }] : [],
          };
        }

        if (
          normalizedSql.includes("SELECT * FROM users WHERE display_name = $1")
        ) {
          return {
            rows: dbState.users.filter(
              (user) => user.display_name === params[0],
            ),
          };
        }

        if (normalizedSql.includes("SELECT * FROM users JOIN posts")) {
          if (normalizedSql.includes("WHERE user_id = $1")) {
            const userId = params[0];
            return {
              rows: buildJoinRows().filter((row) => row.user_id === userId),
            };
          }

          let rows = buildJoinRows();
          if (normalizedSql.includes("ORDER BY created_at DESC")) {
            rows = [...rows].sort(
              (a, b) => new Date(b.created_at) - new Date(a.created_at),
            );
          }
          if (normalizedSql.includes("ORDER BY created_at ASC")) {
            rows = [...rows].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at),
            );
          }

          return { rows };
        }

        if (
          (normalizedSql.includes(
            "INSERT INTO posts (post, user_id, created_at, on_page)",
          ) &&
            normalizedSql.includes("VALUES ($1, $2, $3, $4)") &&
            normalizedSql.includes("RETURNING")) ||
          (normalizedSql.includes(
            "INSERT INTO posts (post, user_id, created_at)",
          ) &&
            normalizedSql.includes("VALUES ($1, $2, $3)") &&
            normalizedSql.includes("RETURNING"))
        ) {
          const post = {
            id: dbState.nextPostId++,
            post: params[0],
            user_id: params[1],
            created_at: params[2],
            on_page: params[3] ?? null,
          };
          dbState.posts.push(post);
          return { rows: [post] };
        }

        if (
          (normalizedSql.includes(
            "INSERT INTO comments (comment_post, user_id, post_id, created_at, on_page)",
          ) &&
            normalizedSql.includes("VALUES ($1, $2, $3, $4, $5)") &&
            normalizedSql.includes("RETURNING")) ||
          (normalizedSql.includes(
            "INSERT INTO comments (comment_post, user_id, post_id, created_at)",
          ) &&
            normalizedSql.includes("VALUES ($1, $2, $3, $4)") &&
            normalizedSql.includes("RETURNING"))
        ) {
          const reply = {
            id: dbState.nextReplyId++,
            comment_post: params[0],
            user_id: params[1],
            post_id: Number(params[2]),
            created_at: params[3],
            on_page: params[4] ?? null,
          };
          dbState.replies.push(reply);
          return { rows: [reply] };
        }

        if (
          (normalizedSql.includes(
            "INSERT INTO replies (reply_post, user_id, comment_id, created_at, on_page)",
          ) &&
            normalizedSql.includes("VALUES ($1, $2, $3, $4, $5)") &&
            normalizedSql.includes("RETURNING")) ||
          (normalizedSql.includes(
            "INSERT INTO replies (reply_post, user_id, comment_id, created_at)",
          ) &&
            normalizedSql.includes("VALUES ($1, $2, $3, $4)") &&
            normalizedSql.includes("RETURNING"))
        ) {
          const finalReply = {
            id: dbState.nextFinalReplyId++,
            reply_post: params[0],
            comment_post: params[0],
            user_id: params[1],
            reply_id: Number(params[2]),
            created_at: params[3],
            on_page: params[4] ?? null,
          };
          dbState.repliesFinalTier.push(finalReply);
          return { rows: [finalReply] };
        }

        if (
          normalizedSql.includes("FROM posts") &&
          normalizedSql.includes(
            "COALESCE(all_comment_data.one_comment_data, '[]'::json) AS comments",
          )
        ) {
          const currentUserId = params[0];
          const isAscSort = normalizedSql.includes(
            "ORDER BY posts.created_at ASC",
          );
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

        if (normalizedSql.includes("SELECT COUNT(*) FROM posts")) {
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
          normalizedSql.includes(
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
          normalizedSql.includes(
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
          normalizedSql.includes(
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
          normalizedSql.includes(
            "SELECT reaction_type FROM reactions_to_finalreply WHERE reply_id = $1 AND user_id = $2",
          )
        ) {
          return {
            rows: dbState.finalReplyReactions
              .filter(
                (item) =>
                  item.reply_id === Number(params[0]) &&
                  item.user_id === Number(params[1]),
              )
              .map((item) => ({ reaction_type: item.reaction_type })),
          };
        }

        if (
          normalizedSql.includes(
            "DELETE FROM reactions_to_finalreply WHERE reply_id = $1 AND user_id = $2",
          )
        ) {
          dbState.finalReplyReactions = dbState.finalReplyReactions.filter(
            (item) =>
              !(
                item.reply_id === Number(params[0]) &&
                item.user_id === Number(params[1])
              ),
          );
          return { rows: [] };
        }

        if (
          normalizedSql.includes(
            "INSERT INTO reactions_to_finalreply (reply_id, user_id, reaction_type)",
          )
        ) {
          const replyId = Number(params[0]);
          const userId = Number(params[1]);
          const reactionType = params[2];
          const existingIndex = dbState.finalReplyReactions.findIndex(
            (item) => item.reply_id === replyId && item.user_id === userId,
          );

          if (existingIndex >= 0) {
            dbState.finalReplyReactions[existingIndex].reaction_type =
              reactionType;
          } else {
            dbState.finalReplyReactions.push({
              reply_id: replyId,
              user_id: userId,
              reaction_type: reactionType,
            });
          }

          return { rows: [{ reaction_type: reactionType }] };
        }

        if (
          normalizedSql.includes(
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

          return { rows: [{ reaction_type: reactionType }] };
        }

        if (
          normalizedSql.includes(
            "SELECT reaction_type FROM comments_reactions WHERE comment_id = $1 AND user_id = $2",
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
          normalizedSql.includes(
            "INSERT INTO comments_reactions (comment_id, user_id, reaction_type, created_at)",
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

          return { rows: [{ reaction_type: reactionType }] };
        }

        if (
          normalizedSql.includes(
            "DELETE FROM comments_reactions WHERE comment_id = $1 AND user_id = $2",
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
          normalizedSql.includes(
            "SELECT reaction_type FROM replies_reactions WHERE reply_id = $1 AND user_id = $2",
          )
        ) {
          return {
            rows: dbState.finalReplyReactions
              .filter(
                (item) =>
                  item.reply_id === Number(params[0]) &&
                  item.user_id === Number(params[1]),
              )
              .map((item) => ({ reaction_type: item.reaction_type })),
          };
        }

        if (
          normalizedSql.includes(
            "INSERT INTO replies_reactions (reply_id, user_id, reaction_type, created_at)",
          )
        ) {
          const replyId = Number(params[0]);
          const userId = Number(params[1]);
          const reactionType = params[2];
          const existingIndex = dbState.finalReplyReactions.findIndex(
            (item) => item.reply_id === replyId && item.user_id === userId,
          );

          if (existingIndex >= 0) {
            dbState.finalReplyReactions[existingIndex].reaction_type =
              reactionType;
          } else {
            dbState.finalReplyReactions.push({
              reply_id: replyId,
              user_id: userId,
              reaction_type: reactionType,
            });
          }

          return { rows: [{ reaction_type: reactionType }] };
        }

        if (
          normalizedSql.includes(
            "DELETE FROM replies_reactions WHERE reply_id = $1 AND user_id = $2",
          )
        ) {
          dbState.finalReplyReactions = dbState.finalReplyReactions.filter(
            (item) =>
              !(
                item.reply_id === Number(params[0]) &&
                item.user_id === Number(params[1])
              ),
          );
          return { rows: [] };
        }

        if (
          normalizedSql.includes(
            "INSERT INTO posts_reactions (post_id, user_id, reaction_type, created_at)",
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

          return { rows: [{ reaction_type: reactionType }] };
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
