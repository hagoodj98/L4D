import { NextFunction } from "express";
import { Request, Response } from "express";
import { getNotificationState } from "../database/repositories/user_notifications.js";

import { NotificationState, NotificationType } from "../types/types.js";
import { cachedUserNotificationState } from "../notification-cache.js";

const notificationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Shared view locals for navbar/account UI across all pages.
  res.locals.user = req.user ? req.user.display_name : null;
  // If the user is authenticated and their notification state is not cached, fetch and cache it.
  if (req.user && !cachedUserNotificationState.has(req.user.id)) {
    const getDatabaseNotificationsState: NotificationState =
      await getNotificationState(req.user.id);
    const toBeCachedNotifications: NotificationType[] =
      getDatabaseNotificationsState?.notification_state?.notifications;
    if (toBeCachedNotifications) {
      cachedUserNotificationState.set(req.user.id, toBeCachedNotifications);
    }
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
