import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when MATTERMOST_URL is missing", () => {
    delete process.env.MATTERMOST_URL;
    process.env.MATTERMOST_TOKEN = "token";
    expect(() => loadConfig()).toThrow("MATTERMOST_URL is required");
  });

  it("throws when MATTERMOST_TOKEN is missing", () => {
    process.env.MATTERMOST_URL = "https://mm.example.com";
    delete process.env.MATTERMOST_TOKEN;
    expect(() => loadConfig()).toThrow("MATTERMOST_TOKEN is required");
  });

  it("throws for invalid protocol", () => {
    process.env.MATTERMOST_URL = "ftp://mm.example.com";
    process.env.MATTERMOST_TOKEN = "token";
    expect(() => loadConfig()).toThrow("http or https");
  });

  it("normalizes trailing slashes", () => {
    process.env.MATTERMOST_URL = "https://mm.example.com///";
    process.env.MATTERMOST_TOKEN = "token";
    const config = loadConfig();
    expect(config.mattermostUrl).toBe("https://mm.example.com");
  });

  it("converts https to wss for websocket URL", () => {
    process.env.MATTERMOST_URL = "https://mm.example.com";
    process.env.MATTERMOST_TOKEN = "token";
    const config = loadConfig();
    expect(config.mattermostWsUrl).toBe("wss://mm.example.com/api/v4/websocket");
  });

  it("converts http to ws for websocket URL", () => {
    process.env.MATTERMOST_URL = "http://mm.local:8065";
    process.env.MATTERMOST_TOKEN = "token";
    const config = loadConfig();
    expect(config.mattermostWsUrl).toBe("ws://mm.local:8065/api/v4/websocket");
  });

  it("uses defaults for optional values", () => {
    process.env.MATTERMOST_URL = "https://mm.example.com";
    process.env.MATTERMOST_TOKEN = "token";
    const config = loadConfig();
    expect(config.slapperMention).toBe("@slapper");
    expect(config.port).toBe(3000);
    expect(config.odesliCountry).toBe("US");
    expect(config.cacheTtlSeconds).toBe(86400);
  });
});
