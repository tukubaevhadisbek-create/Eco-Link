import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EcoLink",
    short_name: "EcoLink",
    description: "EcoLink — Turning Waste into Value",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7FAF8",
    theme_color: "#168B53",
    lang: "ru",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
