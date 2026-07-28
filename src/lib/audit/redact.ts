const SENSITIVE_KEY_PATTERN = /(token|secret|password|access_token|refresh_token|api[_-]?key|authorization|cookie|jwt|otp|totp|mfa[_-]?code)/i;

const REDACTED = "[REDACTED]";

/**
 * Recursively redacts values whose key name looks secret-shaped, so audit
 * logs and error messages can safely include structured context without a
 * human having to remember to scrub every call site by hand.
 */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(val, seen);
    }
    return result;
  }

  return value;
}
