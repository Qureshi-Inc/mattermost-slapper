import { logger } from "../utils/logger.js";
import { TTLCache } from "../utils/cache.js";
import { MattermostClient } from "../mattermost/client.js";
import type { MattermostPost, WebSocketEvent } from "../mattermost/types.js";
import type { MusicResolver } from "../music/types.js";
import { extractUrls, findMusicUrl } from "./urlExtractor.js";
import { formatResponse, formatNoLink } from "./formatter.js";

export class BotHandler {
  private readonly client: MattermostClient;
  private readonly resolver: MusicResolver;
  private readonly mention: string;
  private readonly botUserId: string;
  private readonly dedup = new TTLCache<boolean>(60);

  constructor(
    client: MattermostClient,
    resolver: MusicResolver,
    mention: string,
    botUserId: string,
  ) {
    this.client = client;
    this.resolver = resolver;
    this.mention = mention;
    this.botUserId = botUserId;
  }

  async handleEvent(event: WebSocketEvent): Promise<void> {
    if (event.event !== "posted") return;
    if (!event.data.post) return;

    let post: MattermostPost;
    try {
      post = JSON.parse(event.data.post as string) as MattermostPost;
    } catch {
      logger.warn("Failed to parse post from event");
      return;
    }

    if (post.user_id === this.botUserId) return;
    if (!post.message.includes(this.mention)) return;

    if (this.dedup.has(post.id)) {
      logger.debug("Duplicate event, skipping", { postId: post.id });
      return;
    }
    this.dedup.set(post.id, true);

    logger.info("Processing trigger", {
      postId: post.id,
      channelId: post.channel_id,
    });

    try {
      await this.processPost(post);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Handler error", { postId: post.id, error: message });
      await this.reply(
        post,
        "I couldn't resolve that song right now. The link may be unsupported, unavailable, or incorrectly matched.",
      );
    }
  }

  private async processPost(post: MattermostPost): Promise<void> {
    const threadRootId = post.root_id || post.id;
    let musicUrl: string | null = null;

    const directUrls = this.extractDirectUrl(post.message);
    if (directUrls) {
      musicUrl = directUrls;
    } else {
      const thread = await this.client.getThread(threadRootId);
      const posts = Object.values(thread.posts);
      musicUrl = findMusicUrl(post.message, posts, post.id);
    }

    if (!musicUrl) {
      await this.reply(post, formatNoLink());
      return;
    }

    logger.info("Resolving URL", { url: new URL(musicUrl).hostname, postId: post.id });
    const result = await this.resolver.resolve(musicUrl);
    logger.info("Resolution complete", { postId: post.id, hasResult: !!result });
    const response = formatResponse(result);
    logger.info("Replying to thread", { postId: post.id });
    await this.reply(post, response);
    logger.info("Reply sent", { postId: post.id });
  }

  private extractDirectUrl(message: string): string | null {
    const mentionIndex = message.indexOf(this.mention);
    if (mentionIndex === -1) return null;

    const afterMention = message.slice(mentionIndex + this.mention.length);
    const urls = extractUrls(afterMention);
    return urls.length > 0 ? urls[0] : null;
  }

  private async reply(post: MattermostPost, message: string): Promise<void> {
    const rootId = post.root_id || post.id;
    await this.client.createPost(post.channel_id, rootId, message);
  }
}
