const SUPPORTED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "music.youtube.com",
  "open.spotify.com",
  "music.apple.com",
]);

const TRAILING_PUNCT = /[)\].,;!?]+$/;

export function extractUrls(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.match(urlPattern) || [];
  const results: string[] = [];

  for (let raw of matches) {
    raw = raw.replace(TRAILING_PUNCT, "");

    try {
      const parsed = new URL(raw);
      const hostname = parsed.hostname.toLowerCase();

      if (!isSupportedHost(hostname)) continue;
      if (isNonTrackUrl(parsed)) continue;

      results.push(raw);
    } catch {
      continue;
    }
  }

  return results;
}

function isNonTrackUrl(parsed: URL): boolean {
  const path = parsed.pathname.toLowerCase();
  if (parsed.hostname === "open.spotify.com" && path.startsWith("/search")) return true;
  if (parsed.hostname === "open.spotify.com" && path === "/") return true;
  return false;
}

function isSupportedHost(hostname: string): boolean {
  return SUPPORTED_HOSTS.has(hostname);
}

export function findMusicUrl(
  triggerMessage: string,
  threadPosts: Array<{ message: string; create_at: number; id: string }>,
  triggerPostId: string,
): string | null {
  const directUrls = extractUrls(triggerMessage);
  if (directUrls.length > 0) {
    return directUrls[0];
  }

  const triggerPost = threadPosts.find((p) => p.id === triggerPostId);
  const triggerTime = triggerPost?.create_at ?? Infinity;

  const earlier = threadPosts
    .filter((p) => p.id !== triggerPostId && p.create_at < triggerTime)
    .sort((a, b) => b.create_at - a.create_at);

  for (const post of earlier) {
    const urls = extractUrls(post.message);
    if (urls.length > 0) {
      return urls[urls.length - 1];
    }
  }

  return null;
}
