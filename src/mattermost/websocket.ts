import WebSocket from "ws";
import { logger } from "../utils/logger.js";
import type { WebSocketEvent } from "./types.js";

export type EventHandler = (event: WebSocketEvent) => void;

export class MattermostWebSocket {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly token: string;
  private handler: EventHandler | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private closed = false;
  private authenticated = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isAlive = false;
  // How often to ping, and the max silence before we consider the socket dead.
  private static readonly PING_INTERVAL_MS = 30000;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  onEvent(handler: EventHandler): void {
    this.handler = handler;
  }

  get isAuthenticated(): boolean {
    return this.authenticated;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    this.closed = false;
    this.doConnect();
  }

  close(): void {
    this.closed = true;
    this.authenticated = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.isAlive = true;
    // ws emits "pong" in response to our ping frame. If a full interval passes
    // with no pong, the connection is dead (silent drop — no close frame, which
    // is exactly the failure that left the bot a zombie for days). Terminate so
    // the "close" handler fires and we reconnect.
    this.pingTimer = setInterval(() => {
      if (!this.ws) return;
      if (!this.isAlive) {
        logger.warn("WebSocket heartbeat missed, terminating stale connection");
        this.ws.terminate();
        return;
      }
      this.isAlive = false;
      try {
        this.ws.ping();
      } catch {
        // ignore; terminate will happen on next tick
      }
    }, MattermostWebSocket.PING_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private doConnect(): void {
    if (this.closed) return;

    logger.info("WebSocket connecting", { url: this.url });
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      logger.info("WebSocket connected, authenticating");
      this.reconnectDelay = 1000;
      this.startHeartbeat();
      this.ws!.send(
        JSON.stringify({
          seq: 1,
          action: "authentication_challenge",
          data: { token: this.token },
        }),
      );
    });

    // Any traffic — a pong or a real event — proves the socket is alive.
    this.ws.on("pong", () => {
      this.isAlive = true;
    });

    this.ws.on("message", (data) => {
      this.isAlive = true;
      let event: WebSocketEvent;
      try {
        event = JSON.parse(data.toString());
      } catch {
        logger.warn("Malformed WebSocket message");
        return;
      }

      if (!this.authenticated && event.seq === 1) {
        this.authenticated = true;
        logger.info("WebSocket authenticated");
        return;
      }

      if (event.event && this.handler) {
        this.handler(event);
      }
    });

    this.ws.on("close", () => {
      this.authenticated = false;
      this.stopHeartbeat();
      logger.warn("WebSocket disconnected");
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      logger.error("WebSocket error", { error: err.message });
    });
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    logger.info("Reconnecting in ms", { delay: this.reconnectDelay });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }
}
