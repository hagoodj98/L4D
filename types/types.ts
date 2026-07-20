export type NotificationType = {
  createdAt: string;
  id: string;
  notificationType: string;
  userName: string;
  replyID?: number;
  commentID?: number | string;
  postID?: number;
  sourcePost?: string;
  reactionType?: string;
  post?: string;
  commentPost?: string;
  replyPost?: string;
  wasRead?: boolean;
};
export type NotificationState = {
  notification_state: {
    notifications: NotificationType[];
  };
};
export type ReplyMetaDataType = Pick<
  NotificationType,
  "id" | "replyPost" | "commentID" | "createdAt"
>;
export type NotificationSource = Pick<
  NotificationType,
  "id" | "notificationType"
> & {
  sourcePostType?: string;
  reactionsToPosts?: NotificationType[];
  reactionsToComments?: NotificationType[];
  reactionsToReplies?: NotificationType[];
  repliesToComments?: NotificationType[];
  otherComments?: NotificationType[];
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
export interface Comment {
  id: number;
  comment_post: string;
  user_id: number;
  post_id: string;
  created_at: string;
  updated_at?: string;
  parent_comment_id?: string | null;
}
export interface Reply {
  id: number;
  created_at: string;
  user_id: number;
  reply_post: string;
  comment_id: string;
}
export interface Post {
  id: number;
  post: string;
  user_id: number;
  created_at: string;
  updated_at?: string;
}
export interface ReactionType {
  reaction_type: string;
}
