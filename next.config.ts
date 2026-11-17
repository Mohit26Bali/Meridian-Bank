import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework in an `X-Powered-By` response header.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // KYC submits four base64-encoded images in ONE Server Action (each up to ~3.5 MB per the Zod
      // schema), but Next.js limits Server Action bodies to 1 MB by default, which made real photo
      // uploads fail. Keep this >= 4 x the per-file limit in lib/validations/kyc.ts.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
