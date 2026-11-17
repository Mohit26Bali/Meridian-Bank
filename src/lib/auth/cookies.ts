import { cookies } from "next/headers";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./tokens";

export const ACCESS_TOKEN_COOKIE = "bank_access_token";
export const REFRESH_TOKEN_COOKIE = "bank_refresh_token";

const isProduction = process.env.NODE_ENV === "production";

/** Sets only the short-lived access cookie (used when an existing session is refreshed). */
export async function setAccessTokenCookie(accessToken: string) {
  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export async function setAuthCookies(params: {
  accessToken: string;
  refreshToken: string;
  rememberMe?: boolean;
}) {
  const store = await cookies();
  const refreshMaxAge = params.rememberMe
    ? REFRESH_TOKEN_TTL_SECONDS
    : REFRESH_TOKEN_TTL_SECONDS / 4; // shorter-lived session when not "remembered"

  await setAccessTokenCookie(params.accessToken);

  store.set(REFRESH_TOKEN_COOKIE, params.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: refreshMaxAge,
  });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
}

export async function readAuthCookies() {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_TOKEN_COOKIE)?.value,
    refreshToken: store.get(REFRESH_TOKEN_COOKIE)?.value,
  };
}
