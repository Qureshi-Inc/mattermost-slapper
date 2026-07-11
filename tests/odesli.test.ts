import { describe, it, expect, vi, beforeEach } from "vitest";
import { OdesliResolver } from "../src/music/odesli.js";

describe("OdesliResolver", () => {
  let resolver: OdesliResolver;

  beforeEach(() => {
    resolver = new OdesliResolver("US", 60);
    vi.restoreAllMocks();
  });

  it("parses a full Odesli response", async () => {
    const mockResponse = {
      linksByPlatform: {
        spotify: { url: "https://open.spotify.com/track/abc" },
        appleMusic: { url: "https://music.apple.com/us/album/x/1" },
      },
      entityUniqueId: "SPOTIFY_SONG::abc",
      entitiesByUniqueId: {
        "SPOTIFY_SONG::abc": {
          title: "Test Song",
          artistName: "Test Artist",
          type: "song",
        },
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
      headers: new Headers(),
    } as Response);

    const result = await resolver.resolve("https://youtu.be/abc123");
    expect(result).toEqual({
      title: "Test Song",
      artist: "Test Artist",
      spotifyUrl: "https://open.spotify.com/track/abc",
      appleMusicUrl: "https://music.apple.com/us/album/x/1",
    });
  });

  it("returns null on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers(),
    } as Response);

    const result = await resolver.resolve("https://youtu.be/notfound");
    expect(result).toBeNull();
  });

  it("uses cache on second call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        linksByPlatform: { spotify: { url: "https://open.spotify.com/track/x" } },
        entitiesByUniqueId: {},
      }),
      headers: new Headers(),
    } as Response);

    await resolver.resolve("https://youtu.be/cached");
    await resolver.resolve("https://youtu.be/cached");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
