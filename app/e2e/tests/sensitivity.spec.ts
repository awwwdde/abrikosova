import { test, expect } from "../fixtures.js";
import { cartPath, chooseSlot, cleanup, contacts } from "../support.js";

test.afterAll(() => cleanup("sensitivity"));

test("Чувствительность: ловит 500 при отправке заказа", async ({ page, audit }) => {
  await cartPath(page);
  await chooseSlot(page);
  await contacts(page, "sensitivity", "sensitivity");
  await page.route("**/orders", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ detail: "SMOKE намеренная поломка заказа" }),
    }),
  );
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/orders")),
    page
      .getByRole("complementary", { name: "Ваш заказ" })
      .getByRole("button", { name: "Отправить заказ", exact: true })
      .click(),
  ]);
  expect(response.status()).toBe(500);
  await expect(
    page.getByRole("complementary", { name: "Ваш заказ" }).getByRole("alert"),
  ).toContainText("SMOKE намеренная поломка заказа");
  if (process.env.E2E_PROVE_FAILURE === "1") audit.assertClean();
  else expect(() => audit.assertClean()).toThrow(/Ответы 5xx/);
  await expect(page.getByRole("textbox", { name: "Имя", exact: true })).toHaveValue(/SMOKE Тест/);
});
