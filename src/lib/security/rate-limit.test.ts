import { describe, it, expect } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const key = `test:${crypto.randomUUID()}`;
    const first = checkRateLimit(key, 3, 60_000);
    const second = checkRateLimit(key, 3, 60_000);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it("blocks requests once the limit is exhausted", () => {
    const key = `test:${crypto.randomUUID()}`;
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    const third = checkRateLimit(key, 2, 60_000);
    expect(third.success).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test:${crypto.randomUUID()}`;
    const keyB = `test:${crypto.randomUUID()}`;
    checkRateLimit(keyA, 1, 60_000);
    const blockedA = checkRateLimit(keyA, 1, 60_000);
    const allowedB = checkRateLimit(keyB, 1, 60_000);
    expect(blockedA.success).toBe(false);
    expect(allowedB.success).toBe(true);
  });

  it("resets the window after it expires", async () => {
    const key = `test:${crypto.randomUUID()}`;
    checkRateLimit(key, 1, 30);
    const blocked = checkRateLimit(key, 1, 30);
    expect(blocked.success).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const afterReset = checkRateLimit(key, 1, 30);
    expect(afterReset.success).toBe(true);
  });
});
