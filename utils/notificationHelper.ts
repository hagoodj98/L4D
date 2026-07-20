import { NotificationSource, NotificationType } from "../types/types.js";

export const getAllSourcedNotifications = async (
  sourcedNotifications: NotificationSource[],
) => {
  let getAllOtherUsersNotifications: NotificationType[] = [];

  // If there are notifications, filter them by type and send them to the client.
  if (sourcedNotifications.length > 0) {
    const posts = sourcedNotifications.filter(
      (otherUser) => otherUser.notificationType === "posts_down",
    );
    const comments = sourcedNotifications.filter(
      (otherUser) => otherUser.notificationType === "comments_down",
    );
    const replies = sourcedNotifications.filter(
      (otherUser) => otherUser.notificationType === "replies_down",
    );
    if (posts.length > 0) {
      posts.forEach((notification) => {
        if (!notification.reactionsToPosts) return;
        notification.reactionsToPosts.length > 0 &&
          getAllOtherUsersNotifications.push(...notification.reactionsToPosts);
        if (!notification.otherComments) return;
        notification.otherComments.length > 0 &&
          getAllOtherUsersNotifications.push(...notification.otherComments);
      });
    }
    if (comments.length > 0) {
      comments.forEach((notification) => {
        if (!notification.reactionsToComments) return;
        notification.reactionsToComments.length > 0 &&
          getAllOtherUsersNotifications.push(
            ...notification.reactionsToComments,
          );
        if (!notification.repliesToComments) return;
        notification.repliesToComments.length > 0 &&
          getAllOtherUsersNotifications.push(...notification.repliesToComments);
      });
    }
    if (replies.length > 0) {
      replies.forEach((notification) => {
        if (!notification.reactionsToReplies) return;
        notification.reactionsToReplies.length > 0 &&
          getAllOtherUsersNotifications.push(
            ...notification.reactionsToReplies,
          );
      });
    }
  }
  getAllOtherUsersNotifications.sort(
    // Sort notifications by createdAt in descending order (most recent first)
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return getAllOtherUsersNotifications;
};
