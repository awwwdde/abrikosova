import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type { components } from "../apps/web/lib/api-schema.js";

export type Schema = components["schemas"];
export const root = fileURLToPath(new URL(".", import.meta.url));
export const app = fileURLToPath(new URL("..", import.meta.url));
export const apiURL = process.env.API ?? "http://localhost:8001/api/v1";
export const base = process.env.BASE ?? "http://localhost:3200";
export type Run = {
  id: string;
  category: Schema["CategoryOut"];
  product: Schema["ProductListItem"];
  design: Schema["CustomCakeCard"];
  info: Schema["CustomCakesInfoOut"];
  legacy: { source: string; target: string };
};
export const run = (): Run => JSON.parse(readFileSync(`${root}/.state/run.json`, "utf8")) as Run;
export const prefix = (family = ""): string =>
  `SMOKE Тест ${run().id}${family ? `-${family}` : ""}`;
export const name = (family: string, scenario: string): string => `${prefix(family)}-${scenario}`;
export const email = (scenario: string): string => `${scenario}-${run().id}@example.com`;

export function environment(mode: string, data: object): string {
  return execFileSync(
    "docker",
    ["compose", "exec", "-T", "api", "python", "-", mode, JSON.stringify(data)],
    {
      cwd: app,
      input: readFileSync(`${root}/environment.py`, "utf8"),
      encoding: "utf8",
    },
  ).trim();
}
export function resetLimits(): void {
  execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "redis",
      "sh",
      "-c",
      "redis-cli --scan --pattern 'ratelimit:*' | xargs -r redis-cli del",
    ],
    { cwd: app, stdio: "pipe" },
  );
}
export function cleanup(family = ""): void {
  const stateFiles = readdirSync(`${root}/.state`).filter(
    (file) => file.startsWith(`cart-${run().id}-`) && (!family || file.includes(`-${family}-`)),
  );
  const carts = stateFiles
    .map((file) => JSON.parse(readFileSync(`${root}/.state/${file}`, "utf8")) as string)
    .filter(Boolean);
  console.log(
    `cleanup ${family || "run"}: ${environment("cleanup", { prefix: prefix(family), carts, ...(!family ? { run: run().id } : {}) })}`,
  );
  for (const file of stateFiles) unlinkSync(`${root}/.state/${file}`);
}
export async function get<T>(api: APIRequestContext, path: string): Promise<T> {
  const response = await api.get(`${apiURL}${path}`);
  expect(response.status(), path).toBe(200);
  return (await response.json()) as T;
}
export const money = (value: string | number): string =>
  `${Number(value).toLocaleString("ru-RU")} ₽`;
export const quote = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function cartPath(page: Page): Promise<Schema["CartOut"]> {
  const product = run().product;
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("main").getByRole("link", { name: "Открыть витрину", exact: true }).click();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: run().category.name, exact: true })
    .click();
  await page
    .getByRole("main")
    .getByRole("link", { name: product.name, exact: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name: product.name })).toBeVisible();
  await page
    .getByRole("button", { name: /^В корзину/ })
    .first()
    .click();
  await expect(page.getByRole("banner").getByRole("link", { name: /^Корзина 1/ })).toBeVisible();
  await page
    .getByRole("banner")
    .getByRole("link", { name: /^Корзина/ })
    .click();
  const upsell = page.getByRole("region", { name: "К торту часто берут" });
  await upsell
    .getByRole("button", { name: /^Добавить/ })
    .first()
    .click();
  await expect(page.getByRole("banner").getByRole("link", { name: /^Корзина 2/ })).toBeVisible();
  return get<Schema["CartOut"]>(page.request, "/cart");
}
export async function chooseSlot(page: Page): Promise<void> {
  const date = page
    .getByRole("radiogroup", { name: "Дата", exact: true })
    .getByRole("radio", { disabled: false })
    .first();
  await date.click();
  const slot = page
    .getByRole("radiogroup", { name: "Окно", exact: true })
    .getByRole("radio", { disabled: false })
    .first();
  await slot.click();
  await expect(date).toHaveAttribute("aria-checked", "true");
  await expect(slot).toHaveAttribute("aria-checked", "true");
}
export async function contacts(page: Page, family: string, scenario: string): Promise<void> {
  await page.getByRole("textbox", { name: "Имя", exact: true }).fill(name(family, scenario));
  await page.getByRole("textbox", { name: "Телефон", exact: true }).fill("9161234567");
  await page.getByRole("textbox", { name: "Почта", exact: true }).fill(email(scenario));
  await page.getByRole("checkbox", { name: /Согласен на обработку персональных данных/ }).check();
}
export async function cakeContacts(page: Page, scenario: string): Promise<void> {
  const d = page.getByRole("dialog");
  await d
    .getByRole("radiogroup", { name: "Повод", exact: true })
    .getByRole("radio")
    .first()
    .click();
  await d.getByLabel("Дата праздника").fill(run().info.earliest_date);
  await contacts(page, "cakes", scenario);
}
export async function acceptCake(page: Page): Promise<Schema["ConsultationAccepted"]> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/consultations"),
    ),
    page.getByRole("button", { name: "Отправить заявку", exact: true }).click(),
  ]);
  expect(response.status()).toBe(201);
  const accepted = (await response.json()) as Schema["ConsultationAccepted"];
  expect(accepted.number).toMatch(/^З-\d{8}-[A-F0-9]+$/);
  await expect(page.getByRole("heading", { name: "Заявка принята", exact: true })).toBeVisible();
  await expect(page.getByText(`Заявка № ${accepted.number}`, { exact: true })).toBeVisible();
  await expect(page.getByText(new RegExp(quote(accepted.phone_masked)))).toBeVisible();
  await expect(page.getByText(new RegExp(quote(accepted.email_masked)))).toBeVisible();
  return accepted;
}
