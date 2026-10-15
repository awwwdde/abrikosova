import { request } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  apiURL,
  base,
  environment,
  get,
  resetLimits,
  root,
  type Run,
  type Schema,
} from "./support.js";

export default async function setup(): Promise<void> {
  if (!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD) {
    throw new Error("Заполните E2E_ADMIN_EMAIL и E2E_ADMIN_PASSWORD в app/e2e/.env");
  }
  mkdirSync(`${root}/.state`, { recursive: true });
  mkdirSync(`${root}/.auth`, { recursive: true });
  resetLimits();
  const api = await request.newContext();
  try {
    const ready = await api.get(`${base}/robots.txt`);
    if (ready.status() !== 200)
      throw new Error("Прод-web не готов: запустите app/scripts/web-prod.sh");
    const categories = await get<Schema["CategoryOut"][]>(api, "/catalog/categories");
    const category = categories.find((item) => item.name === "Торты");
    if (!category) throw new Error("В сиде нет категории тортов");
    const products = await get<{ items: Schema["ProductListItem"][] }>(
      api,
      `/catalog/products?category=${encodeURIComponent(category.slug)}&page_size=60&sort=price_asc`,
    );
    const product = products.items.find((item) => item.is_available && item.variants.length > 0);
    const cakes = await get<Schema["CustomCakeListOut"]>(api, "/custom-cakes");
    const design = cakes.items[0];
    if (!product || !design) throw new Error("В сиде нет доступного товара или дизайна");
    const id = randomUUID().slice(0, 8);
    const data: Run = {
      id,
      category,
      product,
      design,
      info: await get<Schema["CustomCakesInfoOut"]>(api, "/custom-cakes/info"),
      legacy: JSON.parse(
        environment("legacy", { run: id, product_id: product.id }),
      ) as Run["legacy"],
    };
    writeFileSync(`${root}/.state/run.json`, JSON.stringify(data));
    // Весь вход происходит в globalSetup, до начала записи тестовых trace.
    for (let index = 0; index < 2; index++) {
      const login = await request.newContext({ extraHTTPHeaders: { Origin: base } });
      try {
        const response = await login.post(`${apiURL}/auth/login`, {
          data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
        });
        if (response.status() !== 200)
          throw new Error(`Вход smoke-админа: HTTP ${response.status()}; проверьте .env`);
        const token = (await response.json()) as Schema["TokenResponse"];
        await login.storageState({ path: `${root}/.auth/${id}-${index}.json` });
        writeFileSync(
          `${root}/.auth/${id}-${index}-access.json`,
          JSON.stringify({ access_token: token.access_token }),
        );
      } finally {
        await login.dispose();
      }
    }
    console.log(`SMOKE run=${id}, API=${apiURL}, BASE=${base}`);
  } finally {
    await api.dispose();
  }
}
