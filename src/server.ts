import Fastify from "fastify";
import { logger } from "./utils/logger.js";

interface HealthState {
  configLoaded: boolean;
  authenticated: boolean;
  wsConnected: boolean;
}

export async function createServer(port: number, getState: () => HealthState) {
  const app = Fastify({ logger: false });

  app.get("/health", async (_req, reply) => {
    return reply.status(200).send({ status: "ok", uptime: process.uptime() });
  });

  app.get("/ready", async (_req, reply) => {
    const state = getState();
    const ready = state.configLoaded && state.authenticated && state.wsConnected;
    const status = ready ? 200 : 503;
    return reply.status(status).send({
      ready,
      config: state.configLoaded,
      authenticated: state.authenticated,
      websocket: state.wsConnected,
    });
  });

  await app.listen({ port, host: "0.0.0.0" });
  logger.info("Health server listening", { port });
  return app;
}
