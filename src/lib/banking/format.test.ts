import { describe, it, expect } from "vitest";
import { formatCurrency, maskAccountNumber } from "./format";

describe("formatCurrency", () => {
  it("formats a numeric amount as USD", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("formats a Decimal-like string amount", () => {
    expect(formatCurrency("48204.12")).toBe("$48,204.12");
  });

  it("formats zero correctly", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("respects an explicit currency code", () => {
    expect(formatCurrency(10, "EUR")).toContain("10.00");
  });
});

describe("maskAccountNumber", () => {
  it("shows only the last four digits", () => {
    expect(maskAccountNumber("1234567890123456")).toBe("••••3456");
  });

  it("handles short account numbers gracefully", () => {
    expect(maskAccountNumber("123")).toBe("••••123");
  });
});
