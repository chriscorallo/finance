import { describe, it, expect } from "vitest";
import { redact } from "./redact";

describe("redact", () => {
  it("redacts keys that look like secrets", () => {
    const result = redact({
      access_token: "abc123",
      refreshToken: "def456",
      password: "hunter2",
      apiKey: "sk-live-xyz",
      normalField: "keep-me",
    }) as Record<string, unknown>;

    expect(result.access_token).toBe("[REDACTED]");
    expect(result.refreshToken).toBe("[REDACTED]");
    expect(result.password).toBe("[REDACTED]");
    expect(result.apiKey).toBe("[REDACTED]");
    expect(result.normalField).toBe("keep-me");
  });

  it("redacts nested objects and arrays", () => {
    const result = redact({
      user: { id: "1", session: { token: "secret-value" } },
      items: [{ authorization: "Bearer xyz" }, { name: "ok" }],
    }) as Record<string, unknown>;

    const user = result.user as Record<string, unknown>;
    const session = user.session as Record<string, unknown>;
    expect(session.token).toBe("[REDACTED]");

    const items = result.items as Record<string, unknown>[];
    expect(items[0].authorization).toBe("[REDACTED]");
    expect(items[1].name).toBe("ok");
  });

  it("handles circular references without crashing", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;

    expect(() => redact(circular)).not.toThrow();
  });

  it("passes through primitives and null unchanged", () => {
    expect(redact(null)).toBeNull();
    expect(redact(42)).toBe(42);
    expect(redact("plain string")).toBe("plain string");
    expect(redact(true)).toBe(true);
  });
});
