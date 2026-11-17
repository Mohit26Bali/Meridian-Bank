// Minimal stand-ins for Next.js request-scoped APIs so Server Actions can be called from Vitest.
// A "browser" is a named cookie jar; useBrowser("alice") switches which jar later calls use.
type Cookie = { value: string };

const jars = new Map<string, Map<string, Cookie>>();
const ips = new Map<string, string>();
let current = "default";

function jar() {
  if (!jars.has(current)) jars.set(current, new Map());
  return jars.get(current)!;
}

export function useBrowser(name: string) {
  current = name;
  if (!ips.has(name)) ips.set(name, `10.0.${ips.size % 250}.${(ips.size * 7 + 1) % 250}`);
  jar();
}
export function getCookie(name: string) {
  return jar().get(name)?.value;
}
export function setCookieRaw(name: string, value: string) {
  jar().set(name, { value });
}
export function clearCookies() {
  jar().clear();
}
export function deleteCookie(name: string) {
  jar().delete(name);
}
export function currentBrowser() {
  return current;
}

export async function cookies() {
  const j = jar();
  return {
    get(name: string) {
      const c = j.get(name);
      return c ? { name, value: c.value } : undefined;
    },
    getAll() {
      return [...j.entries()].map(([name, c]) => ({ name, value: c.value }));
    },
    set(name: string, value: string) {
      j.set(name, { value });
    },
    delete(name: string) {
      j.delete(name);
    },
  };
}

export async function headers() {
  return new Headers({
    "user-agent": "vitest",
    "x-forwarded-for": ips.get(current) ?? "10.0.0.1",
  });
}

// next/cache
export function revalidatePath() {}

// next/navigation
export function redirect(url: string): never {
  throw new Error(`NEXT_REDIRECT:${url}`);
}
export function notFound(): never {
  throw new Error("NEXT_NOT_FOUND");
}
