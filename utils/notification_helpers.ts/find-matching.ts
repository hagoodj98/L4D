import { NotificationType } from "../../types/types.js";

export const findMatchingNotification = (
  cachedNotifications: NotificationType[],
  notifications?: NotificationType[],
): NotificationType[] => {
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
      return (
        notificationTypeMatch &&
        postTypeText &&
        sameID &&
        reactionTypeMatch &&
        createdAtMatch &&
        userMatch
      );
    });
    // If no matching cached notification is found, return the current notification with a new ID and mark it as unread.
    if (cachedNotification) {
      cachedNotification.onPage = notification.onPage;
    }

    return (
      cachedNotification ?? {
        ...notification,
        id: crypto.randomUUID(),
        wasRead: false,
      }
    );
  });
  return filteredNotifications ?? [];
};
