import express from "express";
import { saveNotificationState } from "../../database/repositories/user_notifications.js";
import { buildNotificationState } from "../../utils/notification_helpers.ts/buildnotificationstate.js";
import { findMatchingNotification } from "../../utils/notification_helpers.ts/find-matching.js";
import { cachedUserNotificationState } from "../../notification-cache.js";
// Create a new router instance
const router = express.Router();

router.post("/read-notifications", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  // Update the notifications_read column for the authenticated user.
  const userId = req.user.id;
  const userNotifications = cachedUserNotificationState.get(userId) ?? [];

  const convertNotificationsToRead = userNotifications.map((notification) => {
    if (notification.wasRead === false) {
      notification.wasRead = true;
    }
    return notification;
  });
  //save the updated notification state to the database
  const notificationsRead = await saveNotificationState(
    userId,
    convertNotificationsToRead,
  );
  // Update the cached notification state with the latest data from the database
  cachedUserNotificationState.set(
    userId,
    notificationsRead.notification_state.notifications,
  );
  res.sendStatus(200);
});

router.get("/update-notifications", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  // Set headers for SSE (Server-Sent Events)
  res.setHeader("Content-Type", "text/event-stream"); // Set headers for SSE (Server-Sent Events)
  res.setHeader("Cache-Control", "no-cache"); // Disable caching
  res.setHeader("Connection", "keep-alive"); // Keep the connection open

  // Keep the connection open for future updates
  const intervalId = setInterval(async () => {
    const userID = req.user.id;
    const cachedNotifications = cachedUserNotificationState.get(userID) || [];
    // Fetch the latest notifications from the database and build the notification state for the authenticated user.
    const IndividualNotifications = await buildNotificationState(userID);

    // Compare the cached notifications with the newly fetched notifications to find any matching notifications.
    const filteredAndInitializedNotifications = findMatchingNotification(
      cachedNotifications,
      IndividualNotifications,
    );

    const areAllNotificationsRead = filteredAndInitializedNotifications.every(
      (notification) => notification.wasRead,
    );
    //if none of the notifications are read, including any new notifications, send the count to the client
    if (!areAllNotificationsRead) {
      let payload = {};
      //we want to check if all notifications are unread before we determine how many the other individual notifications are unread
      const allAreUnread = filteredAndInitializedNotifications.filter(
        (notification) => !notification.wasRead,
      ).length;
      // If all notifications are unread, send the count to the client immediately.
      if (allAreUnread === filteredAndInitializedNotifications.length) {
        payload = {
          count: allAreUnread,
          notifications: filteredAndInitializedNotifications,
        };
        cachedUserNotificationState.set(
          userID,
          filteredAndInitializedNotifications,
        );
        res.write(`data: ${JSON.stringify({ payload })}\n\n`);
        return;
      }
      //select the few marked as unread
      const fewAreUnread = filteredAndInitializedNotifications.filter(
        (notification) => !notification.wasRead,
      );
      // Save the updated notification state to the database because we are pulling from database and need to make sure we save this state in the users table. At this point in the code, there was something added to the notifications array that needs to be persisted. As a result, we call the function to save the current state.
      await saveNotificationState(userID, filteredAndInitializedNotifications);
      //save to cache
      cachedUserNotificationState.set(
        userID,
        filteredAndInitializedNotifications,
      );
      // If only a few notifications are unread, send the count to the client.
      if (fewAreUnread.length > 0) {
        payload = {
          count: fewAreUnread.length,
          notifications: filteredAndInitializedNotifications,
        };
      }
      res.write(`data: ${JSON.stringify({ payload })}\n\n`);
      return;
    } else {
      let payload = {};
      payload = {
        "updated-notification-feed": filteredAndInitializedNotifications,
      };

      res.write(`data: ${JSON.stringify({ payload })}\n\n`);

      return;
    }
  }, 5000); // Send updates every 5 seconds

  // Clean up when the client disconnects
  req.on("close", () => {
    clearInterval(intervalId);
    res.end();
  });
});
// Route to load notifications for the authenticated user
router.get("/load-notifications", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  const userId = req.user.id;
  const userNotifications = cachedUserNotificationState.get(userId) || [];

  return res.json({
    notifications: userNotifications,
  });
});

export default router;
