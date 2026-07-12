export interface MattermostPost {
  id: string;
  channel_id: string;
  root_id: string;
  user_id: string;
  message: string;
  create_at: number;
  type: string;
  props?: {
    from_bot?: string;
    [key: string]: unknown;
  };
}

export interface MattermostThread {
  order: string[];
  posts: Record<string, MattermostPost>;
}

export interface MattermostUser {
  id: string;
  username: string;
}

export interface WebSocketEvent {
  event: string;
  data: {
    post?: string;
    [key: string]: unknown;
  };
  broadcast?: {
    channel_id?: string;
  };
  seq?: number;
}
