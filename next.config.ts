import type { NextConfig } from "next";

const wordpressHostname =
  process.env.WORDPRESS_HOSTNAME || "us1.wpdemo.org";
const wordpressUrl = process.env.WORDPRESS_URL;

// Jetpack Photon / WordPress.com CDN (common on BlueHost + Jetpack sites)
const jetpackPhotonHostnames = ["i0.wp.com", "i1.wp.com", "i2.wp.com", "i3.wp.com"];

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow HMR and /_next/* when opening the dev server via LAN IP (e.g. http://192.168.x.x:3000)
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    ...(process.env.ALLOWED_DEV_ORIGINS?.split(",").map((origin) => origin.trim()) ??
      []),
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: wordpressHostname,
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: `www.${wordpressHostname}`,
        port: "",
        pathname: "/**",
      },
      ...jetpackPhotonHostnames.map((hostname) => ({
        protocol: "https" as const,
        hostname,
        port: "",
        pathname: "/**",
      })),
    ],
  },
  async redirects() {
    if (!wordpressUrl) {
      return [];
    }
    return [
      {
        source: "/admin",
        destination: `${wordpressUrl}/wp-admin`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
