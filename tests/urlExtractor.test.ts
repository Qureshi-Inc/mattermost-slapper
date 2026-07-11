import { describe, it, expect } from "vitest";
import { extractUrls, findMusicUrl } from "../src/bot/urlExtractor.js";

describe("extractUrls", () => {
  it("extracts YouTube URLs", () => {
    const urls = extractUrls("check this https://www.youtube.com/watch?v=dQw4w9WgXcQ out");
    expect(urls).toEqual(["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]);
  });

  it("extracts youtu.be URLs", () => {
    const urls = extractUrls("here https://youtu.be/dQw4w9WgXcQ");
    expect(urls).toEqual(["https://youtu.be/dQw4w9WgXcQ"]);
  });

  it("extracts YouTube Music URLs", () => {
    const urls = extractUrls("https://music.youtube.com/watch?v=abc123");
    expect(urls).toEqual(["https://music.youtube.com/watch?v=abc123"]);
  });

  it("extracts Spotify URLs", () => {
    const urls = extractUrls("listen to https://open.spotify.com/track/abc123");
    expect(urls).toEqual(["https://open.spotify.com/track/abc123"]);
  });

  it("extracts Apple Music URLs", () => {
    const urls = extractUrls("https://music.apple.com/us/album/song/123456?i=789");
    expect(urls).toEqual(["https://music.apple.com/us/album/song/123456?i=789"]);
  });

  it("rejects unsupported URLs", () => {
    const urls = extractUrls("https://example.com/song and https://vimeo.com/123");
    expect(urls).toEqual([]);
  });

  it("rejects hostname lookalikes", () => {
    const urls = extractUrls("https://notyoutube.com/watch?v=abc");
    expect(urls).toEqual([]);
  });

  it("strips trailing punctuation", () => {
    const urls = extractUrls("(https://youtu.be/dQw4w9WgXcQ).");
    expect(urls).toEqual(["https://youtu.be/dQw4w9WgXcQ"]);
  });

  it("handles multiple URLs", () => {
    const text = "https://open.spotify.com/track/1 and https://music.apple.com/us/album/x/1";
    const urls = extractUrls(text);
    expect(urls).toHaveLength(2);
  });
});

describe("findMusicUrl", () => {
  it("prefers URL in trigger message", () => {
    const trigger = "@slapper https://youtu.be/abc123";
    const posts = [
      { message: "https://youtu.be/older", create_at: 1000, id: "p1" },
      { message: trigger, create_at: 2000, id: "p2" },
    ];
    expect(findMusicUrl(trigger, posts, "p2")).toBe("https://youtu.be/abc123");
  });

  it("scans backward through thread", () => {
    const posts = [
      { message: "https://youtu.be/first", create_at: 1000, id: "p1" },
      { message: "https://youtu.be/second", create_at: 2000, id: "p2" },
      { message: "@slapper", create_at: 3000, id: "p3" },
    ];
    expect(findMusicUrl("@slapper", posts, "p3")).toBe("https://youtu.be/second");
  });

  it("does not use posts after the trigger", () => {
    const posts = [
      { message: "@slapper", create_at: 1000, id: "p1" },
      { message: "https://youtu.be/later", create_at: 2000, id: "p2" },
    ];
    expect(findMusicUrl("@slapper", posts, "p1")).toBeNull();
  });

  it("returns null when no music URL found", () => {
    const posts = [
      { message: "just chatting", create_at: 1000, id: "p1" },
      { message: "@slapper", create_at: 2000, id: "p2" },
    ];
    expect(findMusicUrl("@slapper", posts, "p2")).toBeNull();
  });
});
