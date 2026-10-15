import { test, expect } from "../fixtures.js";
import {
  cartPath,
  chooseSlot,
  cleanup,
  contacts,
  email,
  get,
  money,
  name,
  type Schema,
} from "../support.js";

test.afterAll(() => cleanup("orders"));

for (const delivery of [false, true]) {
  const scenario = delivery ? "delivery" : "pickup";
  test(
    delivery
      ? "Доставка: адрес, другой получатель и сумма"
      : "Самовывоз: каталог → корзина → заказ → админка",
    async ({ page, admin }) => {
      const cart = await cartPath(page);
      await page
        .getByRole("radio", { name: delivery ? "Доставка" : "Самовывоз", exact: true })
        .click();
      if (delivery) {
        await page
          .getByRole("textbox", { name: "Улица и дом", exact: true })
          .fill("Гжатская улица, 5");
        await page.getByRole("textbox", { name: "Квартира или офис", exact: true }).fill("12");
        await page.getByRole("textbox", { name: "Подъезд", exact: true }).fill("2");
        await page.getByRole("textbox", { name: "Этаж", exact: true }).fill("4");
        await page
          .getByRole("textbox", { name: "Комментарий курьеру", exact: true })
          .fill("SMOKE Домофон 25");
        await page.getByRole("checkbox", { name: "Получит другой человек", exact: true }).check();
        await page
          .getByRole("textbox", { name: "Имя получателя", exact: true })
          .fill("SMOKE Получатель");
        await page
          .getByRole("textbox", { name: "Телефон получателя", exact: true })
          .fill("9161112233");
        await page.getByRole("radio", { name: "Написать в Telegram", exact: true }).click();
      }
      await chooseSlot(page);
      await contacts(page, "orders", scenario);
      await page
        .getByRole("textbox", { name: "Комментарий к заказу", exact: true })
        .fill("SMOKE Проверка заказа");
      const deliveryPrice = Number(
        delivery ? cart.delivery_price_delivery : cart.delivery_price_pickup,
      );
      const total = Number(cart.subtotal) + deliveryPrice;
      const summary = page.getByRole("complementary", { name: "Ваш заказ", exact: true });
      await expect(summary.getByText("Итого", { exact: true }).locator("..")).toContainText(
        money(total),
      );
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/orders")),
        summary.getByRole("button", { name: "Отправить заказ", exact: true }).click(),
      ]);
      expect(response.status()).toBe(201);
      const accepted = (await response.json()) as Schema["OrderCreated"];
      expect(Number(accepted.subtotal)).toBe(Number(cart.subtotal));
      expect(Number(accepted.delivery_price)).toBe(deliveryPrice);
      expect(Number(accepted.total_price)).toBe(total);
      const day = cart.slots[delivery ? "delivery" : "pickup"].find((item) => item.available);
      expect(accepted.desired_date).toBe(day?.date);
      expect(accepted.delivery_interval).toBe(
        day?.intervals.find((item) => item.available)?.interval,
      );
      await expect(page).toHaveURL(/\/order\/[^?]+\?t=.+/);
      await expect(page.getByRole("heading", { name: "Заказ принят", exact: true })).toBeVisible();
      await expect(
        page.getByText(`Заказ № ${accepted.order_number}`, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("banner").getByRole("link", { name: /^Корзина 0/ }),
      ).toBeVisible();
      await page.getByText("Состав заказа", { exact: true }).click();
      await expect(page.getByText("Итого", { exact: true }).locator("..")).toContainText(
        money(total),
      );
      const orders = await get<Schema["OrderListPage"]>(admin.api, "/admin/orders?page_size=100");
      const row = orders.items.find((item) => item.order_number === accepted.order_number);
      expect(row, "Заказ в списке админки").toBeDefined();
      const details = await get<Schema["OrderAdminDetail"]>(admin.api, `/admin/orders/${row!.id}`);
      expect(details).toMatchObject({
        customer_name: name("orders", scenario),
        customer_email: email(scenario),
        customer_comment: "SMOKE Проверка заказа",
        delivery_method: delivery ? "delivery" : "pickup",
        contact_method: delivery ? "telegram" : "call",
      });
      expect(details.customer_phone.replace(/\D/g, "")).toBe("79161234567");
      expect(Number(details.total_price)).toBe(total);
      expect(details.items.map((item) => item.product_id)).toEqual(
        cart.items.map((item) => item.product_id),
      );
      if (delivery) {
        expect(details).toMatchObject({
          delivery_address: "Гжатская улица, 5",
          address_apartment: "12",
          address_entrance: "2",
          address_floor: "4",
          recipient_name: "SMOKE Получатель",
          courier_comment: "SMOKE Домофон 25",
        });
        expect(details.recipient_phone?.replace(/\D/g, "")).toBe("79161112233");
      }
      await admin.page.goto(`/admin/orders/${row!.id}`, { waitUntil: "domcontentloaded" });
      await expect(
        admin.page.getByText(`Заказ № ${accepted.order_number}`, { exact: true }).first(),
      ).toBeVisible();
      await expect(admin.page.getByText(email(scenario), { exact: true })).toBeVisible();
      if (delivery) await expect(admin.page.getByText(/Гжатская улица, 5/).first()).toBeVisible();
    },
  );
}

test("Ошибки формы: пустая отправка, первый фокус и сохранённый ввод", async ({ page }) => {
  await cartPath(page);
  const submit = page
    .getByRole("complementary", { name: "Ваш заказ" })
    .getByRole("button", { name: "Отправить заказ", exact: true });
  await submit.click();
  for (const field of [
    page.getByRole("textbox", { name: "Имя", exact: true }),
    page.getByRole("textbox", { name: "Почта", exact: true }),
    page.getByRole("checkbox", { name: /Согласен на обработку персональных данных/ }),
  ]) {
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAttribute("aria-describedby", /.+-error/);
  }
  await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
  await page.getByRole("textbox", { name: "Имя", exact: true }).fill(name("orders", "errors"));
  await submit.click();
  await expect(page.getByRole("textbox", { name: "Имя", exact: true })).toHaveValue(
    name("orders", "errors"),
  );
  await expect(page.getByRole("textbox", { name: "Почта", exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});
