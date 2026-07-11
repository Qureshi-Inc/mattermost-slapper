import { logger } from "../utils/logger.js";
import type { MattermostPost, MattermostThread, MattermostUser } from "./types.js";

export class MattermostClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/api/v4${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Mattermost API ${method} ${path} failed: ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async getMe(): Promise<MattermostUser> {
    return this.request<MattermostUser>("GET", "/users/me");
  }

  async getThread(postId: string): Promise<MattermostThread> {
    return this.request<MattermostThread>("GET", `/posts/${postId}/thread`);
  }

  async createPost(channelId: string, rootId: string, message: string): Promise<MattermostPost> {
    logger.debug("Creating post", { channelId, rootId });
    return this.request<MattermostPost>("POST", "/posts", {
      channel_id: channelId,
      root_id: rootId,
      message,
    });
  }
}
