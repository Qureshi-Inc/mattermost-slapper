import type { ResolvedSong } from "../music/types.js";

function escapeMarkdown(text: string): string {
  return text.replace(/[[\]()@~`>#+\-=|{}.!*_\\]/g, "\\$&");
}

function formatTitleLine(song: ResolvedSong): string {
  const title = song.title ? escapeMarkdown(song.title) : "Unknown Title";
  const artist = song.artist ? escapeMarkdown(song.artist) : "Unknown Artist";
  return `🎵 **${title} — ${artist}**`;
}

export function formatResponse(song: ResolvedSong | null): string {
  if (song === null) {
    return "I couldn't resolve that song right now. The link may be unsupported, unavailable, or incorrectly matched.";
  }

  const hasSpotify = !!song.spotifyUrl;
  const hasAppleMusic = !!song.appleMusicUrl;

  if (!hasSpotify && !hasAppleMusic) {
    return "I found the song, but I couldn't find this recording on Spotify or Apple Music.";
  }

  const titleLine = formatTitleLine(song);
  const links: string[] = [];
  const notes: string[] = [];

  if (hasSpotify) {
    if (song.spotifyIsSearch) {
      links.push(`[:spotify:](${song.spotifyUrl}) [**Spotify** _(search)_](${song.spotifyUrl})`);
      notes.push("_Exact Spotify link not found — search link provided._");
    } else {
      links.push(`[:spotify:](${song.spotifyUrl}) [**Spotify**](${song.spotifyUrl})`);
    }
  }

  if (hasAppleMusic) {
    if (song.appleMusicIsSearch) {
      links.push(
        `[:applem:](${song.appleMusicUrl}) [**Apple Music** _(search)_](${song.appleMusicUrl})`,
      );
      notes.push("_Exact Apple Music link not found — search link provided._");
    } else {
      links.push(`[:applem:](${song.appleMusicUrl}) [**Apple Music**](${song.appleMusicUrl})`);
    }
  }

  let response = `${titleLine}\n\n${links.join("  ·  ")}`;
  if (notes.length > 0) {
    response += `\n\n${notes.join("\n")}`;
  }

  return response;
}

export function formatNoLink(): string {
  return "I couldn't find a YouTube, Spotify, or Apple Music link earlier in this thread.";
}
