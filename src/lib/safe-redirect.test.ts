import { describe, it, expect } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-site relative paths (including query strings)", () => {
    expect(safeRedirectPath("/dashboard/transfer")).toBe("/dashboard/transfer");
    expect(safeRedirectPath("/dashboard/transactions?type=TRANSFER&page=2")).toBe(
      "/dashboard/transactions?type=TRANSFER&page=2"
    );
    expect(safeRedirectPath("/admin/users")).toBe("/admin/users");
  });

  it("falls back for absolute, protocol-relative and scheme URLs", () => {
    for (const bad of [
      "https://evil.example",
      "http://evil.example/login",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "evil.example",
      "dashboard",
    ]) {
      expect(safeRedirectPath(bad)).toBe("/dashboard");
    }
  });

  it("falls back for empty values and control characters", () => {
    expect(safeRedirectPath(null)).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
    expect(safeRedirectPath("")).toBe("/dashboard");
    expect(safeRedirectPath("/ok\r\nSet-Cookie: x=1")).toBe("/dashboard");
    expect(safeRedirectPath("/ok\u0000")).toBe("/dashboard");
  });

  it("supports a custom fallback", () => {
    expect(safeRedirectPath("https://evil.example", "/login")).toBe("/login");
  });
});
