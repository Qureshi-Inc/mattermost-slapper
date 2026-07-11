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
  const missing: string[] = [];

  if (hasSpotify) {
    links.push(`[:spotify:](${song.spotifyUrl}) [**Spotify**](${song.spotifyUrl})`);
  } else {
    missing.push("_Spotify was not found for this recording._");
  }

  if (hasAppleMusic) {
    links.push(`[:applem:](${song.appleMusicUrl}) [**Apple Music**](${song.appleMusicUrl})`);
  } else {
    missing.push("_Apple Music was not found for this recording._");
  }

  let response = `${titleLine}\n\n${links.join("  ·  ")}`;
  if (missing.length > 0) {
    response += `\n\n${missing.join("\n")}`;
  }

  return response;
}

export function formatNoLink(): string {
  return "I couldn't find a YouTube, Spotify, or Apple Music link earlier in this thread.";
}
