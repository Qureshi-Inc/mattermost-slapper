import { logger } from "../utils/logger.js";
import { getSpotifyToken, parseArtistTitle } from "./fallback.js";

export interface TrackMetadata {
  title: string;
  artist: string;
  spotifyUrl?: string;
  appleMusicUrl?: string;
}

const TIMEOUT_MS = 10000;

export async function fetchMetadata(
  url: string,
  country: string,
  spotifyClientId?: string,
  spotifyClientSecret?: string,
): Promise<TrackMetadata | null> {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();

  try {
    if (host === "music.apple.com") return await fetchAppleMusic(parsed, country);
    if (host === "open.spotify.com") {
      return await fetchSpotify(parsed, spotifyClientId, spotifyClientSecret);
    }
    return await fetchYouTube(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("Metadata fetch error", { error: message, url });
    return null;
  }
}

async function fetchAppleMusic(url: URL, fallbackCountry: string): Promise<TrackMetadata | null> {
  // Song links look like /ca/album/name/123?i=456 or /ca/song/name/456
  const segments = url.pathname.split("/").filter(Boolean);
  const trackId =
    url.searchParams.get("i") ||
    (segments[1] === "song" ? segments[segments.length - 1] : undefined);
  if (!trackId || !/^\d+$/.test(trackId)) {
    logger.warn("Apple Music URL has no track id", { url: url.href });
    return null;
  }

  const storefront = /^[a-z]{2}$/i.test(segments[0] || "") ? segments[0] : fallbackCountry;
  const params = new URLSearchParams({ id: trackId, country: storefront, entity: "song" });
  const res = await fetch(`https://itunes.apple.com/lookup?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    logger.warn("iTunes lookup failed", { status: res.status });
    return null;
  }

  const data = (await res.json()) as {
    results?: Array<{ wrapperType?: string; trackName?: string; artistName?: string }>;
  };
  const track = data.results?.find((r) => r.wrapperType === "track");
  if (!track?.trackName) return null;

  return { title: track.trackName, artist: track.artistName || "", appleMusicUrl: url.href };
}

async function fetchSpotify(
  url: URL,
  clientId?: string,
  clientSecret?: string,
): Promise<TrackMetadata | null> {
  // Paths look like /track/<id> or /intl-xx/track/<id>
  const match = url.pathname.match(/\/track\/([A-Za-z0-9]+)/);
  if (!match) {
    logger.warn("Spotify URL is not a track", { url: url.href });
    return null;
  }
  const trackId = match[1];
  const spotifyUrl = `https://open.spotify.com/track/${trackId}`;

  if (clientId && clientSecret) {
    const token = await getSpotifyToken(clientId, clientSecret);
    if (token) {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const data = (await res.json()) as { name?: string; artists?: Array<{ name?: string }> };
        if (data.name) {
          const artist = data.artists?.[0]?.name || "";
          return { title: data.name, artist, spotifyUrl };
        }
      } else {
        logger.warn("Spotify track lookup failed", { status: res.status });
      }
    }
  }

  // No credentials (or API failed): read the Open Graph tags off the public page.
  // og:description is "Artist · Album · Song · Year".
  const res = await fetch(spotifyUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    logger.warn("Spotify page fetch failed", { status: res.status });
    return null;
  }
  const html = await res.text();
  const title = readMeta(html, "og:title");
  if (!title) return null;
  const artist = readMeta(html, "og:description")?.split(" · ")[0] || "";
  return { title, artist, spotifyUrl };
}

async function fetchYouTube(url: URL): Promise<TrackMetadata | null> {
  const videoId =
    url.hostname === "youtu.be" ? url.pathname.slice(1).split("/")[0] : url.searchParams.get("v");
  if (!videoId) {
    logger.warn("YouTube URL has no video id", { url: url.href });
    return null;
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const params = new URLSearchParams({ url: watchUrl, format: "json" });
  const res = await fetch(`https://www.youtube.com/oembed?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    logger.warn("YouTube oEmbed failed", { status: res.status });
    return null;
  }

  const data = (await res.json()) as { title?: string; author_name?: string };
  if (!data.title) return null;

  // Auto-generated music channels are named "<Artist> - Topic"
  const channel = (data.author_name || "").replace(/\s*-\s*Topic$/i, "");
  return parseArtistTitle(data.title, channel);
}

function readMeta(html: string, property: string): string | undefined {
  const re = new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]*)"`, "i");
  const raw = html.match(re)?.[1];
  return raw ? decodeEntities(raw) : undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
