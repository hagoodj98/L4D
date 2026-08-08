import { NextFunction } from "express";
import { Request, Response } from "express";
import { getNotificationState } from "../database/repositories/user_notifications.js";
import { saveNotificationState } from "../database/repositories/user_notifications.js";
import { buildNotificationState } from "../utils/notification_helpers.ts/buildnotificationstate.js";
import { findMatchingNotification } from "../utils/notification_helpers.ts/find-matching.js";
import { NotificationState, NotificationType } from "../types/types.js";
import { cachedUserNotificationState } from "../notification-cache.js";

const notificationMiddleware = async (
  req: Request,

  res: Response,

  next: NextFunction,
) => {
  // Shared view locals for navbar/account UI across all pages.
  res.locals.user = req.user ? req.user.display_name : null;
  if (req.user) {
    const userID = req.user.id;
    // Check if the user's notification state is already cached. If not, fetch it from the database and cache it.
    if (!cachedUserNotificationState.has(req.user.id)) {
      const getDatabaseNotificationsState: NotificationState =
        await getNotificationState(req.user.id);
      const toBeCachedNotifications: NotificationType[] =
        getDatabaseNotificationsState?.notification_state?.notifications;
      if (toBeCachedNotifications && toBeCachedNotifications.length > 0) {
        cachedUserNotificationState.set(req.user.id, toBeCachedNotifications);
      }
    }
    // Retrieve the cached notification state for the authenticated user, if available.
    const cachedNotifications =
      cachedUserNotificationState.get(req.user.id) ?? [];
    // Fetch the latest notifications from the database and build the notification state for the authenticated user.
    const IndividualNotifications = await buildNotificationState(userID);

    // Compare the cached notifications with the newly fetched notifications to find any matching notifications.
    const filteredNotifications = findMatchingNotification(
      cachedNotifications,
      IndividualNotifications,
    );

    // Mark all individual notifications as unread before saving to the database.
    const initializedNotifications = filteredNotifications.map(
      (notification: NotificationType) => ({
        id: notification?.id ?? crypto.randomUUID(),
        ...notification,
        wasRead: notification?.wasRead ?? false, // Mark as unread if not already read
      }),
    );

    // Save the updated notification state to the database.
    const getNotificationsState = await saveNotificationState(
      req.user.id,
      initializedNotifications,
    );
    // Retrieve the updated notification state from the database response.
    const notificationState =
      getNotificationsState.notification_state.notifications;
    cachedUserNotificationState.set(req.user.id, notificationState);
    res.locals.notificationState = notificationState;
  }
  // Store the current path for active nav link highlighting.
  if (req.path) {
    if (req.path === "/forum") {
      res.locals.currentPath = `${req.path}?page=1`;
    } else {
      res.locals.currentPath = req.path;
    }
  }
  next();
};
export default notificationMiddleware;
