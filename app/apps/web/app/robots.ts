/** robots.txt (задание 012): содержимое — lib/seo-files.ts. */

import { buildRobots } from "@/lib/seo-files";

// SITE_ENV читается при запросе, а не при сборке: один образ может работать и как
// тестовый стенд, и как прод
export const dynamic = "force-dynamic";

export default function robots() {
  return buildRobots(process.env.SITE_ENV);
}
