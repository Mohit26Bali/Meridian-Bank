import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const PUBLIC_ROUTES = [
  "",
  "/personal-banking",
  "/business-banking",
  "/loans",
  "/credit-cards",
  "/investments",
  "/support",
  "/login",
  "/signup",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${APP_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
