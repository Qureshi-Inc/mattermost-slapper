import { describe, it, expect, vi, afterEach } from "vitest";
import { TTLCache } from "../src/utils/cache.js";

describe("TTLCache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves values", () => {
    const cache = new TTLCache<string>(60);
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");
  });

  it("returns undefined for missing keys", () => {
    const cache = new TTLCache<string>(60);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("expires entries after TTL", () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string>(1);
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");

    vi.advanceTimersByTime(1100);
    expect(cache.get("key")).toBeUndefined();
  });

  it("has() returns false for expired entries", () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string>(1);
    cache.set("key", "value");
    vi.advanceTimersByTime(1100);
    expect(cache.has("key")).toBe(false);
  });
});
