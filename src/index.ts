import { loadConfig } from "./config.js";
import { setLogLevel, logger } from "./utils/logger.js";
import { MattermostClient } from "./mattermost/client.js";
import { MattermostWebSocket } from "./mattermost/websocket.js";
import { OdesliResolver } from "./music/odesli.js";
import { BotHandler } from "./bot/handler.js";
import { createServer } from "./server.js";

async function main() {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  logger.info("Starting Mattermost Slapper", {
    mention: config.slapperMention,
    port: config.port,
  });

  const client = new MattermostClient(config.mattermostUrl, config.mattermostToken);

  const me = await client.getMe();
  logger.info("Authenticated as", { userId: me.id, username: me.username });

  const resolver = new OdesliResolver(
    config.odesliCountry,
    config.cacheTtlSeconds,
    config.spotifyClientId,
    config.spotifyClientSecret,
  );
  const handler = new BotHandler(client, resolver, config.slapperMention, me.id);

  const ws = new MattermostWebSocket(config.mattermostWsUrl, config.mattermostToken);
  ws.onEvent((event) => handler.handleEvent(event));
  ws.connect();

  await createServer(config.port, () => ({
    configLoaded: true,
    authenticated: true,
    wsConnected: ws.isAuthenticated,
  }));

  const shutdown = () => {
    logger.info("Shutting down");
    ws.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
