import { describe, it, expect } from "vitest";
import { formatResponse, formatNoLink } from "../src/bot/formatter.js";

describe("formatResponse", () => {
  it("formats both platforms", () => {
    const result = formatResponse({
      title: "Never Gonna Give You Up",
      artist: "Rick Astley",
      spotifyUrl: "https://open.spotify.com/track/123",
      appleMusicUrl: "https://music.apple.com/us/album/x/1",
    });
    expect(result).toContain("Never Gonna Give You Up");
    expect(result).toContain("Rick Astley");
    expect(result).toContain("[**Spotify**](https://open.spotify.com/track/123)");
    expect(result).toContain("[**Apple Music**](https://music.apple.com/us/album/x/1)");
    expect(result).toContain(" · ");
  });

  it("formats Spotify only", () => {
    const result = formatResponse({
      title: "Song",
      artist: "Artist",
      spotifyUrl: "https://open.spotify.com/track/123",
    });
    expect(result).toContain("[**Spotify**]");
    expect(result).toContain("Apple Music was not found for this recording.");
    expect(result).not.toContain("[**Apple Music**]");
  });

  it("formats Apple Music only", () => {
    const result = formatResponse({
      title: "Song",
      artist: "Artist",
      appleMusicUrl: "https://music.apple.com/us/album/x/1",
    });
    expect(result).toContain("[**Apple Music**]");
    expect(result).toContain("Spotify was not found for this recording.");
    expect(result).not.toContain("[**Spotify**]");
  });

  it("handles no platforms found", () => {
    const result = formatResponse({
      title: "Song",
      artist: "Artist",
    });
    expect(result).toBe(
      "I found the song, but I couldn't find this recording on Spotify or Apple Music.",
    );
  });

  it("handles null resolution", () => {
    const result = formatResponse(null);
    expect(result).toContain("couldn't resolve");
  });
});

describe("formatNoLink", () => {
  it("returns the expected message", () => {
    expect(formatNoLink()).toContain("couldn't find a YouTube");
  });
});
