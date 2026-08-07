import { NotificationType } from "../../types/types.js";

export const findMatchingNotification = (
  cachedNotifications: NotificationType[],
  notifications: NotificationType[],
  incomingNotifications: boolean = false,
): NotificationType[] => {
  let initializedNotifications: NotificationType[];
  //Staleness detected. We need to make sure the notifications are up to date as well. User may read all notifications. But another user may undo their reaction to current user's post, etc. We want to make sure any old notifications are shredded from cached array we gotten from database
  const filteredNotifications = notifications?.map((notification) => {
    // Check if the current notification matches any cached notification based on various criteria.
    const cachedNotification = cachedNotifications.find((cacheN) => {
      const notificationTypeMatch =
        cacheN.notificationType === notification.notificationType;
      const postTypeText =
        cacheN.post === notification.post
          ? cacheN.post === notification.post
          : cacheN.commentPost && notification.commentPost
            ? cacheN.commentPost === notification.commentPost
            : cacheN.replyPost && notification.replyPost
              ? cacheN.replyPost === notification.replyPost
              : null;
      const sameID = cacheN.postID
        ? cacheN.postID === notification.postID
        : cacheN.commentID
          ? cacheN.commentID === notification.commentID
          : cacheN.replyID
            ? cacheN.replyID === notification.replyID
            : null;
      const reactionTypeMatch =
        cacheN.reactionType && notification.reactionType
          ? cacheN.reactionType === notification.reactionType
          : true; // If either reactionType is null, consider it a match
      const createdAtMatch = cacheN.createdAt === notification.createdAt;
      const userMatch = cacheN.userName === notification.userName;
      // Check if the cached notification matches the current notification based on various criteria.
      if (
        notificationTypeMatch &&
        postTypeText &&
        sameID &&
        reactionTypeMatch &&
        createdAtMatch &&
        userMatch
      ) {
        return {
          ...notification,
          id: cacheN.id,
        };
      }
    });
    if (incomingNotifications) {
      return (
        cachedNotification ?? {
          ...notification,
          id: crypto.randomUUID(),
          wasRead: false,
        }
      );
    }
    return (
      cachedNotification ?? {
        ...notification,
      }
    );
  });
  if (!incomingNotifications) {
    // Mark all individual notifications as unread before saving to the database.
    initializedNotifications = filteredNotifications.map(
      (notification: NotificationType) => ({
        id: notification?.id ?? crypto.randomUUID(),
        ...notification,
        wasRead: notification?.wasRead ?? false, // Mark as unread if not already read
      }),
    );
    return initializedNotifications;
  }
  initializedNotifications = filteredNotifications;
  return initializedNotifications;
};
