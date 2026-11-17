/**
 * Returns `value` only if it is a same-site relative path, otherwise `fallback`.
 * Used for the post-login `redirectTo` query parameter so a crafted link such as
 * /login?redirectTo=https://evil.example (or //evil.example, /\evil.example) cannot send a freshly
 * authenticated user to another site.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback; // absolute URLs, "javascript:", "https:", bare words
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback; // protocol-relative
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback; // backslashes / control characters
  return value;
}
