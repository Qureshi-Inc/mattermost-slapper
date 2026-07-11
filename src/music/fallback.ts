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
  const url = `https://open.spotify.com/search/${encoded}`;
  logger.info("Spotify search URL generated", { url });
  return url;
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
