import {
  test as baseTest,
  expect,
  request,
  type Page,
  type APIRequestContext,
  type ConsoleMessage,
  type Response,
} from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { base, root, run, type Schema } from "./support.js";

const expectedFailures = [
  // Отдельный проверочный тест сознательно ломает только отправку заказа.
  { title: /^Чувствительность: ловит 500/, path: "/api/v1/orders", status: 500 },
  // Анонимный /admin штатно получает 401 refresh перед переходом на вход.
  { title: /^Страницы и служебное/, path: "/api/v1/auth/refresh", status: 401 },
];
const pathname = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
};
export class NetworkAudit {
  errors: { message: string; path: string; status: number }[] = [];
  serverErrors: { path: string; status: number }[] = [];
  private detach: (() => void)[] = [];
  constructor(
    page: Page,
    private title: string,
  ) {
    this.attach(page);
  }
  attach(page: Page): void {
    const onConsole = (message: ConsoleMessage) => {
      if (message.type() === "error")
        this.errors.push({
          message: message.text(),
          path: pathname(message.location().url),
          status: Number(message.text().match(/status of (\d+)/)?.[1] ?? 0),
        });
    };
    const onError = (error: Error) =>
      this.errors.push({ message: error.message, path: "", status: 0 });
    const onResponse = (response: Response) => {
      if (response.status() >= 500)
        this.serverErrors.push({ status: response.status(), path: pathname(response.url()) });
    };
    page.on("console", onConsole);
    page.on("pageerror", onError);
    page.on("response", onResponse);
    this.detach.push(() => {
      page.off("console", onConsole);
      page.off("pageerror", onError);
      page.off("response", onResponse);
    });
  }
  assertClean(allowExpected = false): void {
    const unexpected = (event: { path: string; status: number }) =>
      !allowExpected ||
      !expectedFailures.some(
        (rule) =>
          rule.title.test(this.title) && event.path === rule.path && event.status === rule.status,
      );
    expect(this.serverErrors.filter(unexpected), "Ответы 5xx").toEqual([]);
    expect(this.errors.filter(unexpected), "Ошибки консоли").toEqual([]);
  }
  dispose(): void {
    this.detach.forEach((detach) => detach());
  }
}
type Admin = { page: Page; api: APIRequestContext };
export const test = baseTest.extend<{ audit: NetworkAudit }, { admin: Admin }>({
  audit: [
    async ({ page, admin }, use, info) => {
      const audit = new NetworkAudit(page, info.title);
      audit.attach(admin.page);
      await use(audit);
      const cart = (await page.context().cookies()).find((cookie) => cookie.name === "cart_id");
      if (cart) {
        const family = info.file.includes("cakes")
          ? "cakes"
          : info.file.includes("sensitivity")
            ? "sensitivity"
            : "orders";
        writeFileSync(
          `${root}/.state/cart-${run().id}-${family}-${info.testId.replace(/[^a-zA-Z0-9-]/g, "")}.json`,
          JSON.stringify(cart.value),
        );
      }
      audit.dispose();
      audit.assertClean(true);
    },
    { auto: true },
  ],
  admin: [
    async ({ browser }, use, info) => {
      // Здесь только сохранённое состояние; пароль используется до тестов в globalSetup.
      const state = `${root}/.auth/${run().id}-${info.parallelIndex}.json`;
      const token = JSON.parse(
        readFileSync(`${root}/.auth/${run().id}-${info.parallelIndex}-access.json`, "utf8"),
      ) as Pick<Schema["TokenResponse"], "access_token">;
      const context = await browser.newContext({
        storageState: state,
        baseURL: base,
        reducedMotion: "reduce",
        viewport: { width: 1512, height: 982 },
      });
      const api = await request.newContext({
        extraHTTPHeaders: { Authorization: `Bearer ${token.access_token}`, Origin: base },
      });
      try {
        await use({ page: await context.newPage(), api });
      } finally {
        await context.storageState({ path: state });
        await api.dispose();
        await context.close();
      }
    },
    { scope: "worker" },
  ],
});
export { expect };
