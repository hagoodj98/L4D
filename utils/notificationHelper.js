export const getAllSourcedNotifications = async (sourcedNotifications) => {
  let getAllOtherUsersNotifications = [];

  // If there are notifications, filter them by type and send them to the client.
  if (sourcedNotifications.length > 0) {
    const posts = sourcedNotifications.filter(
      (otherUser) => otherUser.notification_type === "posts_down",
    );
    const comments = sourcedNotifications.filter(
      (otherUser) => otherUser.notification_type === "comments_down",
    );
    const replies = sourcedNotifications.filter(
      (otherUser) => otherUser.notification_type === "replies_down",
    );
    if (posts.length > 0) {
      posts.forEach((notification) => {
        notification.reactions_to_posts.length > 0 &&
          getAllOtherUsersNotifications.push(
            ...notification.reactions_to_posts,
          );
        notification.other_comments.length > 0 &&
          getAllOtherUsersNotifications.push(...notification.other_comments);
      });
    }
    if (comments.length > 0) {
      comments.forEach((notification) => {
        getAllOtherUsersNotifications.push(
          ...notification.reactions_to_comments,
        );
        getAllOtherUsersNotifications.push(...notification.replies_to_comments);
      });
    }
    if (replies.length > 0) {
      replies.forEach((notification) => {
        notification.reactions_to_replies.length > 0 &&
          getAllOtherUsersNotifications.push(
            ...notification.reactions_to_replies,
          );
      });
    }
  }
  getAllOtherUsersNotifications.sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );

  return getAllOtherUsersNotifications;
};
