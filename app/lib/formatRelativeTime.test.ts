import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime } from "./formatRelativeTime";

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function freeze(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  }

  it("returns seconds for very recent timestamps", () => {
    freeze("2026-01-15T12:00:30Z");
    expect(formatRelativeTime("2026-01-15T12:00:00Z")).toBe("30s ago");
  });

  it("returns minutes", () => {
    freeze("2026-01-15T12:05:00Z");
    expect(formatRelativeTime("2026-01-15T12:00:00Z")).toBe("5m ago");
  });

  it("returns hours", () => {
    freeze("2026-01-15T15:00:00Z");
    expect(formatRelativeTime("2026-01-15T12:00:00Z")).toBe("3h ago");
  });

  it("returns days", () => {
    freeze("2026-01-20T12:00:00Z");
    expect(formatRelativeTime("2026-01-15T12:00:00Z")).toBe("5d ago");
  });

  it("returns locale date string for 30+ days", () => {
    freeze("2026-03-15T12:00:00Z");
    const result = formatRelativeTime("2026-01-15T12:00:00Z");
    expect(result).not.toContain("ago");
    expect(result).toContain("2026");
  });

  it("clamps minimum to 1s", () => {
    freeze("2026-01-15T12:00:00Z");
    expect(formatRelativeTime("2026-01-15T12:00:00Z")).toBe("1s ago");
  });
});
