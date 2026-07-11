import { logger } from "../utils/logger.js";

export async function searchAppleMusic(
  title: string,
  artist: string,
  country: string,
): Promise<string | null> {
  const query = `${title} ${artist}`.trim();
  if (!query) return null;

  const params = new URLSearchParams({
    term: query,
    media: "music",
    entity: "song",
    country,
    limit: "5",
  });

  try {
    const res = await fetch(`https://itunes.apple.com/search?${params}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      logger.warn("iTunes search failed", { status: res.status });
      return null;
    }

    const data = (await res.json()) as {
      results?: Array<{ trackViewUrl?: string; trackName?: string; artistName?: string }>;
    };

    if (!data.results || data.results.length === 0) return null;

    const match = findBestMatch(data.results, title, artist);
    if (match?.trackViewUrl) {
      logger.info("Apple Music fallback found", { url: match.trackViewUrl });
      return match.trackViewUrl;
    }

    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("iTunes search error", { error: message });
    return null;
  }
}

export function buildSpotifySearchUrl(title: string, artist: string): string | null {
  const query = `${title} ${artist}`.trim();
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  return `https://open.spotify.com/search/results/${encoded}`;
}

export function buildAppleMusicSearchUrl(title: string, artist: string): string | null {
  const query = `${title} ${artist}`.trim();
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  return `https://music.apple.com/us/search?term=${encoded}`;
}

export async function searchSpotifyApi(
  title: string,
  artist: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const query = `track:${title} artist:${artist}`.trim();
  if (!query) return null;

  try {
    const token = await getSpotifyToken(clientId, clientSecret);
    if (!token) return null;

    const params = new URLSearchParams({ q: query, type: "track", limit: "5" });
    const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      logger.warn("Spotify API search failed", { status: res.status });
      return null;
    }

    const data = (await res.json()) as {
      tracks?: {
        items?: Array<{
          external_urls?: { spotify?: string };
          name?: string;
          artists?: Array<{ name?: string }>;
        }>;
      };
    };

    const items = data.tracks?.items;
    if (!items || items.length === 0) return null;

    const match = findBestSpotifyMatch(items, title, artist);
    if (match?.external_urls?.spotify) {
      logger.info("Spotify API fallback found", { url: match.external_urls.spotify });
      return match.external_urls.spotify;
    }

    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("Spotify API search error", { error: message });
    return null;
  }
}


let cachedSpotifyToken: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<string | null> {
  if (cachedSpotifyToken && Date.now() < cachedSpotifyToken.expiresAt) {
    return cachedSpotifyToken.token;
  }

  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    cachedSpotifyToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000 - 60000,
    };

    return data.access_token;
  } catch {
    return null;
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function findBestMatch(
  results: Array<{ trackViewUrl?: string; trackName?: string; artistName?: string }>,
  title: string,
  artist: string,
): (typeof results)[0] | null {
  const normTitle = normalize(title);
  const normArtist = normalize(artist);

  for (const r of results) {
    const rTitle = normalize(r.trackName || "");
    const rArtist = normalize(r.artistName || "");
    if (rTitle.includes(normTitle) || normTitle.includes(rTitle)) {
      if (rArtist.includes(normArtist) || normArtist.includes(rArtist)) {
        return r;
      }
    }
  }

  return results[0];
}

function findBestSpotifyMatch(
  items: Array<{
    external_urls?: { spotify?: string };
    name?: string;
    artists?: Array<{ name?: string }>;
  }>,
  title: string,
  artist: string,
): (typeof items)[0] | null {
  const normTitle = normalize(title);
  const normArtist = normalize(artist);

  for (const item of items) {
    const rTitle = normalize(item.name || "");
    const rArtist = normalize(item.artists?.map((a) => a.name).join(" ") || "");
    if (rTitle.includes(normTitle) || normTitle.includes(rTitle)) {
      if (rArtist.includes(normArtist) || normArtist.includes(rArtist)) {
        return item;
      }
    }
  }

  return items[0];
}
