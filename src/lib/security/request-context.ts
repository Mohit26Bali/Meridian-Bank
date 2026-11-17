import "server-only";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { clientIpFromForwardedFor, getTrustedProxyHops } from "./client-ip";

let warnedAboutProxyConfig = false;

/**
 * Client IP and user agent for rate limiting, audit logs and login history.
 *
 * Forwarding headers are client-controlled unless a trusted proxy sets them, so they are used ONLY when
 * TRUSTED_PROXY_HOPS is set to the number of reverse proxies in front of the app (see
 * lib/security/client-ip.ts). With the default (0) no IP is derived and IP-keyed limits fall back to
 * per-account keys. Behind a proxy/CDN (Vercel, Render, nginx, ...) set TRUSTED_PROXY_HOPS=1.
 */
export async function getRequestContext() {
  const headerList = await headers();
  const hops = getTrustedProxyHops();

  let ipAddress: string | undefined;
  if (hops > 0) {
    ipAddress = clientIpFromForwardedFor(headerList.get("x-forwarded-for"), hops);
    if (!ipAddress) {
      const realIp = headerList.get("x-real-ip")?.trim();
      ipAddress = realIp && isIP(realIp) ? realIp : undefined;
    }
  } else if (process.env.NODE_ENV === "production" && !warnedAboutProxyConfig) {
    warnedAboutProxyConfig = true;
    console.warn(
      "[security] TRUSTED_PROXY_HOPS is not set: client IPs are not recorded and IP-based rate limits are shared. " +
        "Set it to the number of reverse proxies in front of this app (usually 1)."
    );
  }

  const userAgent = headerList.get("user-agent")?.slice(0, 300) ?? undefined;
  return { ipAddress, userAgent };
}
