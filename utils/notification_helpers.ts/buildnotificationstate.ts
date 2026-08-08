import { fetchAllNotifications } from "../../database/repositories/user_notifications.js";
import { getAllSourcedNotifications as mergeAllSourcedNotifications } from "./parse-individually.js";

export const buildNotificationState = async (userID: number) => {
  // Fetch notifications for posts, comments, and replies for the authenticated user from the database.

  let {
    postsNotificationsSource,
    commentsNotificationSource,
    repliesNotificationsSource,
  } = await fetchAllNotifications(userID);

  // Merge all notifications into a single array for the authenticated user.
  let refreshedNotifcationSource = [
    ...postsNotificationsSource,
    ...commentsNotificationSource,
    ...repliesNotificationsSource,
  ];
  // Process and merge all sourced notifications with the cached notifications.
  const IndividualNotifications = await mergeAllSourcedNotifications(
    refreshedNotifcationSource,
  );

  return IndividualNotifications;
};
