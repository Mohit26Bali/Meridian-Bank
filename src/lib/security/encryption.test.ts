import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "crypto";
import { encryptSecret, decryptSecret } from "./encryption";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips plaintext through encryption and decryption", () => {
    const plaintext = "4111111111111111";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same input");
    const b = encryptSecret("same input");
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext (GCM auth tag check)", () => {
    const encrypted = encryptSecret("sensitive value");
    const raw = Buffer.from(encrypted, "base64");
    raw[raw.length - 1] ^= 0xff; // flip a byte in the ciphertext
    const tampered = raw.toString("base64");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws when ENCRYPTION_KEY is missing", () => {
    const original = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/ENCRYPTION_KEY is missing/);
    process.env.ENCRYPTION_KEY = original;
  });

  it("throws when ENCRYPTION_KEY is the wrong length", () => {
    const original = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
    process.env.ENCRYPTION_KEY = original;
  });
});
