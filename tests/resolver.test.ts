import { describe, it, expect, vi, beforeEach } from "vitest";
import { MusicLinkResolver } from "../src/music/resolver.js";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  } as Response;
}

function htmlResponse(html: string): Response {
  return {
    ok: true,
    status: 200,
    text: async () => html,
    headers: new Headers(),
  } as Response;
}

type Route = [match: string, respond: () => Response];

function mockFetch(routes: Route[]) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const route = routes.find(([match]) => url.includes(match));
    if (!route) throw new Error(`Unmocked fetch: ${url}`);
    return route[1]();
  });
}

describe("MusicLinkResolver", () => {
  let resolver: MusicLinkResolver;

  beforeEach(() => {
    vi.restoreAllMocks();
    resolver = new MusicLinkResolver("US", 60);
  });

  it("resolves an Apple Music link via iTunes lookup, then searches Spotify", async () => {
    const fetchSpy = mockFetch([
      [
        "itunes.apple.com/lookup",
        () =>
          jsonResponse({
            results: [
              {
                wrapperType: "track",
                trackName: "Alfaaz",
                artistName: "Hamza Malik & Zain Zohaib",
              },
            ],
          }),
      ],
    ]);

    const url = "https://music.apple.com/ca/album/alfaaz/6780842656?i=6780842658";
    const result = await resolver.resolve(url);

    expect(result).toEqual({
      title: "Alfaaz",
      artist: "Hamza Malik & Zain Zohaib",
      appleMusicUrl: url,
      spotifyUrl:
        "https://open.spotify.com/search/results/Alfaaz%20Hamza%20Malik%20%26%20Zain%20Zohaib",
      spotifyIsSearch: true,
    });
    const lookupUrl = String(fetchSpy.mock.calls[0][0]);
    expect(lookupUrl).toContain("id=6780842658");
    expect(lookupUrl).toContain("country=ca");
  });

  it("resolves a Spotify link from page metadata without API credentials", async () => {
    mockFetch([
      [
        "open.spotify.com/track/",
        () =>
          htmlResponse(
            '<meta property="og:title" content="Never Gonna Give You Up"/>' +
              '<meta property="og:description" content="Rick Astley · Whenever You Need Somebody · Song · 1987"/>',
          ),
      ],
      [
        "itunes.apple.com/search",
        () =>
          jsonResponse({
            results: [
              {
                trackName: "Never Gonna Give You Up",
                artistName: "Rick Astley",
                trackViewUrl: "https://music.apple.com/us/album/x/1?i=2",
              },
            ],
          }),
      ],
    ]);

    const result = await resolver.resolve(
      "https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT?si=abc",
    );

    expect(result).toEqual({
      title: "Never Gonna Give You Up",
      artist: "Rick Astley",
      spotifyUrl: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
      appleMusicUrl: "https://music.apple.com/us/album/x/1?i=2",
    });
  });

  it("uses the Spotify API for track metadata when credentials are set", async () => {
    resolver = new MusicLinkResolver("US", 60, "id", "secret");
    mockFetch([
      ["accounts.spotify.com", () => jsonResponse({ access_token: "tok", expires_in: 3600 })],
      [
        "api.spotify.com/v1/tracks/",
        () => jsonResponse({ name: "Song A", artists: [{ name: "Artist A" }] }),
      ],
      ["itunes.apple.com/search", () => jsonResponse({ results: [] })],
    ]);

    const result = await resolver.resolve("https://open.spotify.com/track/abc123");

    expect(result?.title).toBe("Song A");
    expect(result?.artist).toBe("Artist A");
    expect(result?.spotifyUrl).toBe("https://open.spotify.com/track/abc123");
    expect(result?.appleMusicIsSearch).toBe(true);
  });

  it("resolves a YouTube link via oEmbed and splits artist from title", async () => {
    const fetchSpy = mockFetch([
      [
        "youtube.com/oembed",
        () =>
          jsonResponse({
            title: "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
            author_name: "Rick Astley",
          }),
      ],
      ["itunes.apple.com/search", () => jsonResponse({ results: [] })],
    ]);

    const result = await resolver.resolve("https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=x");

    expect(result?.title).toBe("Never Gonna Give You Up");
    expect(result?.artist).toBe("Rick Astley");
    expect(result?.spotifyUrl).toBe(
      "https://open.spotify.com/search/results/Never%20Gonna%20Give%20You%20Up%20Rick%20Astley",
    );
    const oembedUrl = decodeURIComponent(String(fetchSpy.mock.calls[0][0]));
    expect(oembedUrl).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("strips ' - Topic' from YouTube auto-generated channel names", async () => {
    mockFetch([
      [
        "youtube.com/oembed",
        () => jsonResponse({ title: "Alfaaz", author_name: "Hamza Malik - Topic" }),
      ],
      ["itunes.apple.com/search", () => jsonResponse({ results: [] })],
    ]);

    const result = await resolver.resolve("https://youtu.be/abc123");
    expect(result?.artist).toBe("Hamza Malik");
  });

  it("returns null and does not cache when metadata lookup fails", async () => {
    const fetchSpy = mockFetch([["youtube.com/oembed", () => jsonResponse({}, 404)]]);

    expect(await resolver.resolve("https://youtu.be/notfound")).toBeNull();
    expect(await resolver.resolve("https://youtu.be/notfound")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("uses cache on second call", async () => {
    const fetchSpy = mockFetch([
      ["youtube.com/oembed", () => jsonResponse({ title: "A - B", author_name: "x" })],
      ["itunes.apple.com/search", () => jsonResponse({ results: [] })],
    ]);

    await resolver.resolve("https://youtu.be/cached");
    const callsAfterFirst = fetchSpy.mock.calls.length;
    await resolver.resolve("https://youtu.be/cached");

    expect(fetchSpy).toHaveBeenCalledTimes(callsAfterFirst);
  });
});
