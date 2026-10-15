import { test, expect } from "../fixtures.js";
import { base, run } from "../support.js";

test("Страницы и служебное: 200, шапка, h1, 404, SEO, legacy 301, вход", async ({ page }) => {
  const paths = [
    "/",
    "/catalog",
    `/product/${run().product.slug}`,
    "/custom-cakes",
    `/custom-cakes/${run().design.slug}`,
    "/gallery",
    "/about",
    "/contacts",
    "/privacy",
    "/consent",
  ];
  for (const path of paths) {
    const response = await page.request.get(path);
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    expect(html, path).toMatch(/<header[\s>]/);
    expect(html, path).toMatch(/<h1[\s>]/);
  }
  const missing = await page.request.get(`/smoke-no-page-${run().id}`);
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain("Страница не найдена");
  // Стиль 404 проверяем в HTML: браузерный GET 404 сам пишет console.error,
  // а ответы 404 должны оставаться штатным сценарием, не исключением детектора.
  expect(await missing.text()).toMatch(/<header[\s>]/);
  expect(await missing.text()).toMatch(/<h1[\s>]/);
  const robots = await page.request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap:");
  expect(await robots.text()).toContain("Allow: /");
  expect(await robots.text()).not.toContain("Disallow: /custom-cakes");
  const sitemap = await page.request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("/custom-cakes");
  const redirect = await page.request.get(run().legacy.source, { maxRedirects: 0 });
  expect(redirect.status()).toBe(301);
  expect(new URL(redirect.headers().location, base).pathname).toBe(run().legacy.target);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("button", { name: "Войти", exact: true })).toBeVisible();
});
