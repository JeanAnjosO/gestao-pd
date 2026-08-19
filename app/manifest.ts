import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gestão PD Buritis",
    short_name: "Gestão PD",
    description: "Escalas, faltas, calendário e gestão da equipe PD Buritis.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f3ec",
    theme_color: "#173c2c",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
