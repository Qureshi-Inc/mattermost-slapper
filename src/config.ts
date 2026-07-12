export interface Config {
  mattermostUrl: string;
  mattermostWsUrl: string;
  mattermostToken: string;
  slapperMention: string;
  odesliCountry: string;
  port: number;
  logLevel: string;
  cacheTtlSeconds: number;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  autoResolveChannelIds: string[];
}

export function loadConfig(): Config {
  const mattermostUrl = process.env.MATTERMOST_URL;
  const mattermostToken = process.env.MATTERMOST_TOKEN;

  if (!mattermostUrl) {
    throw new Error("MATTERMOST_URL is required");
  }
  if (!mattermostToken) {
    throw new Error("MATTERMOST_TOKEN is required");
  }

  const url = new URL(mattermostUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("MATTERMOST_URL must use http or https protocol");
  }

  const normalizedUrl = mattermostUrl.replace(/\/+$/, "");
  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
  const mattermostWsUrl = `${wsProtocol}//${url.host}${url.pathname.replace(/\/+$/, "")}/api/v4/websocket`;

  const port = parseInt(process.env.PORT || "3000", 10);
  const cacheTtlSeconds = parseInt(process.env.CACHE_TTL_SECONDS || "86400", 10);

  return {
    mattermostUrl: normalizedUrl,
    mattermostWsUrl,
    mattermostToken,
    slapperMention: process.env.SLAPPER_MENTION || "@slapper",
    odesliCountry: process.env.ODESLI_COUNTRY || "US",
    port: isNaN(port) ? 3000 : port,
    logLevel: process.env.LOG_LEVEL || "info",
    cacheTtlSeconds: isNaN(cacheTtlSeconds) ? 86400 : cacheTtlSeconds,
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    autoResolveChannelIds: (process.env.AUTO_RESOLVE_CHANNEL_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
