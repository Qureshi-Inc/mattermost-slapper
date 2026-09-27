import { logger } from "../utils/logger.js";
import { TTLCache } from "../utils/cache.js";
import {
  searchAppleMusic,
  searchSpotifyApi,
  buildSpotifySearchUrl,
  buildAppleMusicSearchUrl,
} from "./fallback.js";
import { fetchMetadata } from "./metadata.js";
import type { MusicResolver, ResolvedSong } from "./types.js";

export class MusicLinkResolver implements MusicResolver {
  private readonly country: string;
  private readonly cache: TTLCache<ResolvedSong | null>;
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

    const metadata = await fetchMetadata(
      normalizedUrl,
      this.country,
      this.spotifyClientId,
      this.spotifyClientSecret,
    );
    if (!metadata) {
      // Don't cache failures — they're usually transient network errors
      return null;
    }

    logger.info("Metadata found", { title: metadata.title, artist: metadata.artist });
    const result = await this.fillMissing({ ...metadata });
    this.cache.set(normalizedUrl, result);
    return result;
  }

  private async fillMissing(song: ResolvedSong): Promise<ResolvedSong> {
    if (song.spotifyUrl && song.appleMusicUrl) return song;
    if (!song.title) return song;

    const title = song.title;
    const artist = song.artist || "";

    if (!song.appleMusicUrl) {
      logger.info("Searching Apple Music", { title, artist });
      song.appleMusicUrl = (await searchAppleMusic(title, artist, this.country)) ?? undefined;
    }

    if (!song.appleMusicUrl) {
      song.appleMusicUrl = buildAppleMusicSearchUrl(title, artist) ?? undefined;
      song.appleMusicIsSearch = true;
    }

    if (!song.spotifyUrl && this.spotifyClientId && this.spotifyClientSecret) {
      logger.info("Searching Spotify API", { title, artist });
      song.spotifyUrl =
        (await searchSpotifyApi(title, artist, this.spotifyClientId, this.spotifyClientSecret)) ??
        undefined;
    }

    if (!song.spotifyUrl) {
      song.spotifyUrl = buildSpotifySearchUrl(title, artist) ?? undefined;
      song.spotifyIsSearch = true;
    }

    return song;
  }
}
