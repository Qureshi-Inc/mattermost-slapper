import { describe, it, expect, vi, beforeEach } from "vitest";
import { BotHandler } from "../src/bot/handler.js";
import type { MattermostClient } from "../src/mattermost/client.js";
import type { MusicResolver } from "../src/music/types.js";
import type { WebSocketEvent } from "../src/mattermost/types.js";

function makeEvent(post: object): WebSocketEvent {
  return {
    event: "posted",
    data: { post: JSON.stringify(post) },
  };
}

describe("BotHandler", () => {
  let mockClient: MattermostClient;
  let mockResolver: MusicResolver;
  let handler: BotHandler;

  beforeEach(() => {
    mockClient = {
      getMe: vi.fn(),
      getThread: vi.fn().mockResolvedValue({ order: [], posts: {} }),
      createPost: vi.fn().mockResolvedValue({}),
    } as unknown as MattermostClient;

    mockResolver = {
      resolve: vi.fn().mockResolvedValue({
        title: "Test",
        artist: "Artist",
        spotifyUrl: "https://open.spotify.com/track/x",
        appleMusicUrl: "https://music.apple.com/us/album/x/1",
      }),
    };

    handler = new BotHandler(mockClient, mockResolver, "@slapper", "bot-user-id");
  });

  it("ignores messages from the bot itself", async () => {
    const event = makeEvent({
      id: "p1",
      channel_id: "ch1",
      root_id: "",
      user_id: "bot-user-id",
      message: "@slapper",
      create_at: 1000,
    });

    await handler.handleEvent(event);
    expect(mockClient.createPost).not.toHaveBeenCalled();
  });

  it("ignores messages without the mention", async () => {
    const event = makeEvent({
      id: "p1",
      channel_id: "ch1",
      root_id: "",
      user_id: "user1",
      message: "hello world",
      create_at: 1000,
    });

    await handler.handleEvent(event);
    expect(mockClient.createPost).not.toHaveBeenCalled();
  });

  it("deduplicates events with the same post ID", async () => {
    const event = makeEvent({
      id: "p1",
      channel_id: "ch1",
      root_id: "",
      user_id: "user1",
      message: "@slapper https://youtu.be/abc",
      create_at: 1000,
    });

    await handler.handleEvent(event);
    await handler.handleEvent(event);

    expect(mockResolver.resolve).toHaveBeenCalledTimes(1);
  });

  it("resolves a direct URL in the trigger message", async () => {
    const event = makeEvent({
      id: "p1",
      channel_id: "ch1",
      root_id: "",
      user_id: "user1",
      message: "@slapper https://youtu.be/dQw4w9WgXcQ",
      create_at: 1000,
    });

    await handler.handleEvent(event);

    expect(mockResolver.resolve).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ");
    expect(mockClient.createPost).toHaveBeenCalled();
  });

  it("replies with no-link message when no URL found", async () => {
    const event = makeEvent({
      id: "p2",
      channel_id: "ch1",
      root_id: "root1",
      user_id: "user1",
      message: "@slapper",
      create_at: 2000,
    });

    (mockClient.getThread as ReturnType<typeof vi.fn>).mockResolvedValue({
      order: ["root1", "p2"],
      posts: {
        root1: { id: "root1", message: "hey", create_at: 1000, channel_id: "ch1" },
        p2: { id: "p2", message: "@slapper", create_at: 2000, channel_id: "ch1" },
      },
    });

    await handler.handleEvent(event);

    const call = (mockClient.createPost as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[2]).toContain("couldn't find");
  });
});
