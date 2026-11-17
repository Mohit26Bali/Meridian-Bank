import argon2 from "argon2";

const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB, OWASP minimum recommendation for argon2id
  timeCost: 2,
  parallelism: 1,
} satisfies argon2.HashOptions;

export async function hashPassword(plainText: string): Promise<string> {
  return argon2.hash(plainText, HASH_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  plainText: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainText);
  } catch {
    return false;
  }
}
