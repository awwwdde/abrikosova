/** manifest.webmanifest (задание 012): имя, цвета бренда и иконки-монограммы. */

import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Абрикосова",
    description: "Торты и десерты по авторским рецептурам Елены Абрикосовой",
    start_url: "/",
    display: "browser",
    lang: "ru",
    theme_color: "#842124",
    background_color: "#FBF7F0",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
