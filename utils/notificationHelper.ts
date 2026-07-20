import { NotificationSource, NotificationType } from "../types/types.js";

export const getAllSourcedNotifications = async (
  sourcedNotifications: NotificationSource[],
) => {
  let getAllOtherUsersNotifications: NotificationType[] = [];

  const notificationTypeOf = (item: NotificationSource & any) =>
    item.notificationType ?? item.notification_type;
  const reactionsToPostsOf = (item: NotificationSource & any) =>
    item.reactionsToPosts ?? item.reactions_to_posts;
  const otherCommentsOf = (item: NotificationSource & any) =>
    item.otherComments ?? item.other_comments;
  const reactionsToCommentsOf = (item: NotificationSource & any) =>
    item.reactionsToComments ?? item.reactions_to_comments;
  const repliesToCommentsOf = (item: NotificationSource & any) =>
    item.repliesToComments ?? item.replies_to_comments;
  const reactionsToRepliesOf = (item: NotificationSource & any) =>
    item.reactionsToReplies ?? item.reactions_to_replies;

  // If there are notifications, filter them by type and send them to the client.
  if (sourcedNotifications.length > 0) {
    const posts = sourcedNotifications.filter(
      (otherUser: NotificationSource) =>
        notificationTypeOf(otherUser) === "posts_down",
    );
    const comments = sourcedNotifications.filter(
      (otherUser: NotificationSource) =>
        notificationTypeOf(otherUser) === "comments_down",
    );
    const replies = sourcedNotifications.filter(
      (otherUser: NotificationSource) =>
        notificationTypeOf(otherUser) === "replies_down",
    );
    if (posts.length > 0) {
      posts.forEach((notification) => {
        const reactionsToPosts = reactionsToPostsOf(notification) ?? [];
        const otherComments = otherCommentsOf(notification) ?? [];

        reactionsToPosts.length > 0 &&
          getAllOtherUsersNotifications.push(...reactionsToPosts);
        otherComments.length > 0 &&
          getAllOtherUsersNotifications.push(...otherComments);
      });
    }
    if (comments.length > 0) {
      comments.forEach((notification) => {
        const reactionsToComments = reactionsToCommentsOf(notification) ?? [];
        const repliesToComments = repliesToCommentsOf(notification) ?? [];

        reactionsToComments.length > 0 &&
          getAllOtherUsersNotifications.push(...reactionsToComments);
        repliesToComments.length > 0 &&
          getAllOtherUsersNotifications.push(...repliesToComments);
      });
    }
    if (replies.length > 0) {
      replies.forEach((notification) => {
        const reactionsToReplies = reactionsToRepliesOf(notification) ?? [];
        reactionsToReplies.length > 0 &&
          getAllOtherUsersNotifications.push(...reactionsToReplies);
      });
    }
  }
  getAllOtherUsersNotifications.sort(
    // Sort notifications by createdAt in descending order (most recent first)
    (a: any, b: any) =>
      new Date(b.createdAt ?? b.created_at).getTime() -
      new Date(a.createdAt ?? a.created_at).getTime(),
  );

  return getAllOtherUsersNotifications;
};
