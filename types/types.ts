export type NotificationType = {
  createdAt: string;
  id?: string;
  notificationType: string;
  userName: string;
  replyID?: number;
  commentID?: number | string;
  postID?: number;
  sourcePost?: string;
  reactionType?: boolean | string;
  post?: string;
  onPage: string;
  type?: string;
  commentPost?: string;
  replyPost?: string;
  wasRead?: boolean;
  userID?: number;
};
export type NotificationState = {
  notification_state: {
    notifications: NotificationType[];
  };
};
export type NotificationSource = Pick<NotificationType, "id"> & {
  notification_type?: string;
  sourcePostType?: string;
  reactions_to_posts?: NotificationSourceType[];
  reactions_to_comments?: NotificationSourceType[];
  reactions_to_replies?: NotificationSourceType[];
  replies_to_comments?: NotificationSourceType[];
  other_comments?: NotificationSourceType[];
  on_page?: string;
};
export type CacheNotificationState = Map<number, NotificationType[]>;
export interface User {
  id: number;
  display_name: string;
  email: string;
  password: string;
  discord_id?: string;
  google_id?: string;
  twitch_id?: string;
  provider: string;
  notification_state: {
    notifications: NotificationType[];
  };
}
export type PostMeta = Pick<NotificationType, "id" | "post" | "type"> &
  Pick<NotificationSourceType, "created_at">;
export type CommentMeta = Pick<
  NotificationType,
  "id" | "commentPost" | "type"
> &
  Pick<NotificationSourceType, "created_at" | "comment_id" | "comment_post">;
export type ReplyMeta = Pick<NotificationType, "id" | "type"> &
  Pick<NotificationSourceType, "created_at" | "reply_post" | "comment_id">;
export interface ReactionType {
  reaction_type: string;
}

export interface NotificationSourceType {
  id: string;
  comment_post?: string;
  created_at: string;
  notification_type: string;
  post_id?: number;
  on_page: string;
  source_post: string;
  user_name: string;
  post?: string;
  comment_id?: string;
  reply_post?: string;
  reaction_type?: string;
  reply_id?: number;
}
