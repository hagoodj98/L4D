import {
  NotificationSource,
  NotificationSourceType,
  NotificationType,
} from "../types/types.js";

export const getAllSourcedNotifications = async (
  sourcedNotifications: NotificationSource[],
) => {
  let getAllOtherUsersNotifications: NotificationType[] = [];

  const notificationTypeOf = (
    item: NotificationSource & { notification_type?: string },
  ) => {
    return { notificationType: item.notification_type };
  };
  const reactionsToPostsOf = (
    notificationItem: NotificationSourceType[] | undefined,
  ): NotificationType[] => {
    let reactionsToPosts: NotificationType[] = [];
    notificationItem?.forEach((reaction) => {
      reactionsToPosts.push({
        postID: reaction.post_id,
        notificationType: reaction.notification_type,
        sourcePost: reaction.source_post,
        userName: reaction.user_name,
        post: reaction.post,
        createdAt: reaction.created_at,
        reactionType: reaction.reaction_type,
      });
    });
    return reactionsToPosts;
  };
  const otherCommentsOf = (
    notificationItem: NotificationSourceType[] | undefined,
  ) => {
    let otherComments: NotificationType[] = [];
    notificationItem?.forEach((comment) => {
      otherComments.push({
        postID: comment.post_id,
        notificationType: comment.notification_type,
        sourcePost: comment.source_post,
        userName: comment.user_name,
        commentPost: comment.comment_post,
        createdAt: comment.created_at,
      });
    });
    return otherComments;
  };
  const reactionsToCommentsOf = (
    notificationItem: NotificationSourceType[] | undefined,
  ) => {
    let reactionsToComments: NotificationType[] = [];
    notificationItem?.forEach((reaction) => {
      reactionsToComments.push({
        commentID: reaction.comment_id,
        notificationType: reaction.notification_type,
        sourcePost: reaction.source_post,
        userName: reaction.user_name,
        commentPost: reaction.comment_post,
        createdAt: reaction.created_at,
        reactionType: reaction.reaction_type,
      });
    });
    return reactionsToComments;
  };
  const repliesToCommentsOf = (
    notificationItem: NotificationSourceType[] | undefined,
  ) => {
    let repliesToComments: NotificationType[] = [];
    notificationItem?.forEach((reply) => {
      repliesToComments.push({
        commentID: reply.comment_id,
        notificationType: reply.notification_type,
        sourcePost: reply.source_post,
        userName: reply.user_name,
        replyPost: reply.reply_post,
        createdAt: reply.created_at,
      });
    });
    return repliesToComments;
  };
  const reactionsToRepliesOf = (
    notificationItem: NotificationSourceType[] | undefined,
  ) => {
    let reactionsToReplies: NotificationType[] = [];
    notificationItem?.forEach((reaction) => {
      reactionsToReplies.push({
        replyID: reaction.reply_id,
        notificationType: reaction.notification_type,
        sourcePost: reaction.source_post,
        userName: reaction.user_name,
        replyPost: reaction.reply_post,
        createdAt: reaction.created_at,
        reactionType: reaction.reaction_type,
      });
    });
    return reactionsToReplies;
  };

  // If there are notifications, filter them by type and send them to the client.
  if (sourcedNotifications.length > 0) {
    const posts = sourcedNotifications.filter(
      (otherUser: NotificationSource) =>
        notificationTypeOf(otherUser).notificationType === "posts_down",
    );
    const comments = sourcedNotifications.filter(
      (otherUser: NotificationSource) =>
        notificationTypeOf(otherUser).notificationType === "comments_down",
    );
    const replies = sourcedNotifications.filter(
      (otherUser: NotificationSource) =>
        notificationTypeOf(otherUser).notificationType === "replies_down",
    );
    if (posts.length > 0) {
      posts.forEach((notification) => {
        if (Array.isArray(notification.reactions_to_posts)) {
          if (notification.reactions_to_posts.length > 0) {
            const reactionsToPosts = reactionsToPostsOf(
              notification.reactions_to_posts,
            );
            reactionsToPosts.length > 0 &&
              getAllOtherUsersNotifications.push(...reactionsToPosts);
          }
        }
        if (Array.isArray(notification.other_comments)) {
          if (notification.other_comments.length > 0) {
            const otherComments = otherCommentsOf(notification.other_comments);
            otherComments.length > 0 &&
              getAllOtherUsersNotifications.push(...otherComments);
          }
        }
      });
    }
    if (comments.length > 0) {
      comments.forEach((notification) => {
        if (
          Array.isArray(notification.reactions_to_comments) &&
          notification.reactions_to_comments.length > 0
        ) {
          const reactionsToComments = reactionsToCommentsOf(
            notification.reactions_to_comments,
          );
          reactionsToComments.length > 0 &&
            getAllOtherUsersNotifications.push(...reactionsToComments);
        }
        if (Array.isArray(notification.replies_to_comments)) {
          if (notification.replies_to_comments.length > 0) {
            const repliesToComments = repliesToCommentsOf(
              notification.replies_to_comments,
            );
            repliesToComments.length > 0 &&
              getAllOtherUsersNotifications.push(...repliesToComments);
          }
        }
      });
    }
    if (replies.length > 0) {
      replies.forEach((notification) => {
        if (
          Array.isArray(notification.reactions_to_replies) &&
          notification.reactions_to_replies.length > 0
        ) {
          const reactionsToReplies = reactionsToRepliesOf(
            notification.reactions_to_replies,
          );

          getAllOtherUsersNotifications.push(...reactionsToReplies);
        }
      });
    }
  }
  getAllOtherUsersNotifications.sort(
    // Sort notifications by createdAt in descending order (most recent first)
    (
      a: Pick<NotificationType, "createdAt">,
      b: Pick<NotificationType, "createdAt">,
    ) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return getAllOtherUsersNotifications;
};
