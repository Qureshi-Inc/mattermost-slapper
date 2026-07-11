import { logger } from "../utils/logger.js";
import { TTLCache } from "../utils/cache.js";
import { searchAppleMusic, searchSpotifyApi, buildSpotifySearchUrl } from "./fallback.js";
import type { MusicResolver, ResolvedSong } from "./types.js";

interface OdesliEntity {
  title?: string;
  artistName?: string;
  type?: string;
}

interface OdesliResponse {
  linksByPlatform?: {
    spotify?: { url?: string };
    appleMusic?: { url?: string };
  };
  entitiesByUniqueId?: Record<string, OdesliEntity>;
  entityUniqueId?: string;
}

export class OdesliResolver implements MusicResolver {
  private readonly country: string;
  private readonly cache: TTLCache<ResolvedSong | null>;
  private readonly baseUrl = "https://api.song.link/v1-alpha.1/links";
  private readonly spotifyClientId?: string;
  private readonly spotifyClientSecret?: string;

  constructor(
    country: string,
    cacheTtlSeconds: number,
    spotifyClientId?: string,
    spotifyClientSecret?: string,
  ) {
    this.country = country;
    this.cache = new TTLCache<ResolvedSong | null>(cacheTtlSeconds);
    this.spotifyClientId = spotifyClientId;
    this.spotifyClientSecret = spotifyClientSecret;
  }

  async resolve(url: string): Promise<ResolvedSong | null> {
    const normalizedUrl = url.trim();
    const cached = this.cache.get(normalizedUrl);
    if (cached !== undefined) {
      logger.debug("Cache hit", { url: normalizedUrl });
      return cached;
    }

    logger.debug("Cache miss, resolving", { url: normalizedUrl });

    const result = await this.fetchWithRetry(normalizedUrl);
    this.cache.set(normalizedUrl, result);
    return result;
  }

  private async fetchWithRetry(url: string, attempt = 0): Promise<ResolvedSong | null> {
    const maxRetries = 2;
    const params = new URLSearchParams({ url, userCountry: this.country });
    const requestUrl = `${this.baseUrl}?${params}`;

    try {
      logger.info("Odesli request starting", { url, attempt });
      const res = await fetch(requestUrl, {
        signal: AbortSignal.timeout(30000),
      });
      logger.info("Odesli response received", { status: res.status });

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        if (attempt < maxRetries) {
          const retryAfter = parseInt(res.headers.get("Retry-After") || "", 10);
          const delay = isNaN(retryAfter) ? 1000 * (attempt + 1) : retryAfter * 1000;
          logger.warn("Odesli retrying", { status: res.status, attempt, delay });
          await new Promise((r) => setTimeout(r, delay));
          return this.fetchWithRetry(url, attempt + 1);
        }
        logger.error("Odesli max retries exceeded", { status: res.status });
        return null;
      }

      if (!res.ok) {
        logger.warn("Odesli request failed", { status: res.status, url });
        return null;
      }

      const data = (await res.json()) as OdesliResponse;
      const result = this.parseResponse(data);
      return this.fillMissing(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Odesli request error", { error: message, url });
      return null;
    }
  }

  private async fillMissing(song: ResolvedSong): Promise<ResolvedSong> {
    if (song.spotifyUrl && song.appleMusicUrl) return song;
    if (!song.title) return song;

    const title = song.title;
    const artist = song.artist || "";

    if (!song.appleMusicUrl) {
      logger.info("Fallback: searching Apple Music", { title, artist });
      song.appleMusicUrl = (await searchAppleMusic(title, artist, this.country)) ?? undefined;
    }

    if (!song.spotifyUrl && this.spotifyClientId && this.spotifyClientSecret) {
      logger.info("Fallback: searching Spotify API", { title, artist });
      song.spotifyUrl =
        (await searchSpotifyApi(title, artist, this.spotifyClientId, this.spotifyClientSecret)) ??
        undefined;
    }

    if (!song.spotifyUrl) {
      logger.info("Fallback: generating Spotify search URL", { title, artist });
      song.spotifyUrl = buildSpotifySearchUrl(title, artist) ?? undefined;
    }

    return song;
  }

  private parseResponse(data: OdesliResponse): ResolvedSong {
    const spotifyUrl = data.linksByPlatform?.spotify?.url;
    const appleMusicUrl = data.linksByPlatform?.appleMusic?.url;

    let title: string | undefined;
    let artist: string | undefined;

    if (data.entitiesByUniqueId) {
      const primaryEntity = data.entityUniqueId
        ? data.entitiesByUniqueId[data.entityUniqueId]
        : undefined;

      const entity =
        primaryEntity ||
        Object.values(data.entitiesByUniqueId).find((e) => e.type === "song") ||
        Object.values(data.entitiesByUniqueId)[0];

      if (entity) {
        title = entity.title;
        artist = entity.artistName;
      }
    }

    return {
      title,
      artist,
      spotifyUrl: this.validateUrl(spotifyUrl),
      appleMusicUrl: this.validateUrl(appleMusicUrl),
    };
  }

  private validateUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
      return url;
    } catch {
      return undefined;
    }
  }
}
