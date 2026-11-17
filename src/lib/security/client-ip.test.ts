import { describe, it, expect } from "vitest";
import { clientIpFromForwardedFor } from "./client-ip";

describe("clientIpFromForwardedFor", () => {
  it("trusts nothing when no proxy is configured", () => {
    expect(clientIpFromForwardedFor("203.0.113.9", 0)).toBeUndefined();
    expect(clientIpFromForwardedFor("203.0.113.9, 10.0.0.1", 0)).toBeUndefined();
  });

  it("takes the entry added by the single trusted proxy (rightmost)", () => {
    expect(clientIpFromForwardedFor("203.0.113.9", 1)).toBe("203.0.113.9");
  });

  it("ignores values the client forged on the left", () => {
    // attacker sent "X-Forwarded-For: 1.2.3.4"; the one trusted proxy appended the real address
    expect(clientIpFromForwardedFor("1.2.3.4, 198.51.100.7", 1)).toBe("198.51.100.7");
  });

  it("counts hops from the right with several proxies (e.g. CDN + load balancer)", () => {
    expect(clientIpFromForwardedFor("9.9.9.9, 203.0.113.9, 10.1.1.1", 2)).toBe("203.0.113.9");
    expect(clientIpFromForwardedFor("9.9.9.9, 203.0.113.9, 10.1.1.1", 3)).toBe("9.9.9.9");
  });

  it("falls back to the leftmost entry if the chain is shorter than the configured hops", () => {
    expect(clientIpFromForwardedFor("203.0.113.9", 3)).toBe("203.0.113.9");
  });

  it("supports IPv6 and rejects garbage", () => {
    expect(clientIpFromForwardedFor("2001:db8::1", 1)).toBe("2001:db8::1");
    expect(clientIpFromForwardedFor("not-an-ip", 1)).toBeUndefined();
    expect(clientIpFromForwardedFor("1.2.3.4, <script>", 1)).toBeUndefined();
    expect(clientIpFromForwardedFor("", 1)).toBeUndefined();
    expect(clientIpFromForwardedFor(null, 1)).toBeUndefined();
  });
});
