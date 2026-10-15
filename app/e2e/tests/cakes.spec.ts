import { readFileSync } from "node:fs";
import { test, expect } from "../fixtures.js";
import {
  acceptCake,
  cakeContacts,
  cleanup,
  email,
  get,
  name,
  quote,
  root,
  run,
  type Schema,
} from "../support.js";

test.afterAll(() => cleanup("cakes"));

test("Торт из дизайна: фильтр → дизайн → принята → админка", async ({ page, admin }) => {
  const design = run().design;
  const list = await get<Schema["CustomCakeListOut"]>(page.request, "/custom-cakes");
  const facet = list.facets.find((item) => item.value === design.occasion)!;
  await page.goto("/custom-cakes", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("main")
    .getByRole("link", { name: new RegExp(`^${quote(facet.label)}`) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`occasion=${design.occasion}`));
  await page.getByRole("main").getByRole("link", { name: design.title, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: design.title })).toBeVisible();
  const fillings = await get<Schema["FillingCardOut"][]>(page.request, "/custom-cakes/fillings");
  await page
    .getByRole("combobox", { name: "Начинка", exact: true })
    .selectOption(String(fillings[0].id));
  await page.getByRole("link", { name: "Оставить заявку", exact: true }).click();
  const d = page.getByRole("dialog");
  await expect(d.getByRole("heading", { name: "Заявка на торт", exact: true })).toBeVisible();
  await expect(d.getByRole("combobox", { name: "Начинка", exact: true })).toHaveValue(
    String(fillings[0].id),
  );
  await expect(d.getByLabel("Гостей", { exact: true })).toHaveValue(String(design.min_guests));
  await cakeContacts(page, "design");
  await d.getByRole("textbox", { name: "Пожелания к виду", exact: true }).fill("SMOKE Белые пионы");
  const extra = run().info.extras[0];
  if (extra) await d.getByRole("checkbox", { name: extra.name, exact: true }).check();
  const accepted = await acceptCake(page);
  const row = await get<Schema["ConsultationAdminOut"]>(
    admin.api,
    `/admin/consultations/${accepted.id}`,
  );
  expect(row).toMatchObject({
    number: accepted.number,
    name: name("cakes", "design"),
    email: email("design"),
    guests_count: design.min_guests,
    design: { id: design.id },
    filling: { id: fillings[0].id },
    wishes: "SMOKE Белые пионы",
    consent_pd: true,
    contact_method: "call",
    delivery_method: "pickup",
  });
  if (extra) expect(row.extras.map((item) => item.name)).toContain(extra.name);
  await admin.page.goto(`/admin/consultations/${accepted.id}`, { waitUntil: "domcontentloaded" });
  await expect(admin.page.getByText(new RegExp(quote(accepted.number))).first()).toBeVisible();
  await expect(admin.page.getByText(email("design"), { exact: true })).toBeVisible();
});

test("Свой образец: тип и шестое фото отклонены, одно фото принято", async ({ page, admin }) => {
  await page.goto("/custom-cakes?request=1", { waitUntil: "domcontentloaded" });
  const d = page.getByRole("dialog");
  const upload = d.getByLabel("выберите файл", { exact: true });
  const uploadId = await upload.getAttribute("id");
  await upload.setInputFiles({
    name: "unsupported.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("SMOKE not a photo"),
  });
  await expect(d.getByText(/unsupported.txt.*JPEG/)).toBeVisible();
  const buffer = readFileSync(`${root}/fixtures/photo.jpg`);
  await upload.setInputFiles(
    Array.from({ length: 6 }, (_, index) => ({
      name: `smoke-${index}.jpg`,
      mimeType: "image/jpeg",
      buffer,
    })),
  );
  const previews = d.getByRole("list", { name: "Фото-образцы" }).getByRole("listitem");
  await expect(previews).toHaveCount(5);
  await expect(d.getByText(/Не больше 5 фото.*smoke-5.jpg/)).toBeVisible();
  // При пяти фото подпись выбора исчезает; сохраняем связь через id самого input.
  await expect(d.locator(`input[id="${uploadId}"]`)).toBeDisabled();
  for (let index = 0; index < 4; index++)
    await d
      .getByRole("button", { name: /^Убрать фото/ })
      .first()
      .click();
  await expect(previews).toHaveCount(1);
  await cakeContacts(page, "own");
  const accepted = await acceptCake(page);
  const row = await get<Schema["ConsultationAdminOut"]>(
    admin.api,
    `/admin/consultations/${accepted.id}`,
  );
  expect(row).toMatchObject({
    name: name("cakes", "own"),
    email: email("own"),
    design: null,
    gallery_item: null,
    has_reference: true,
  });
  expect(row.image_ids).toHaveLength(1);
  const image = await admin.api.get(
    `${process.env.API ?? "http://localhost:8001/api/v1"}/admin/consultations/${accepted.id}/images/${row.image_ids[0]}`,
  );
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/webp");
});

test("Заказать похожий: работа → образец → gallery_item_id в админке", async ({ page, admin }) => {
  await page.goto("/gallery", { waitUntil: "domcontentloaded" });
  const work = page.getByRole("main").getByRole("article").first();
  await work.hover();
  const link = work.getByRole("link", { name: /Заказать похожий/ }).first();
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  const id = Number(new URL(href!, "http://localhost").searchParams.get("like"));
  expect(id).toBeGreaterThan(0);
  await link.click();
  const d = page.getByRole("dialog");
  await expect(d.getByRole("button", { name: /^Убрать\s*:/ })).toBeVisible();
  await cakeContacts(page, "like");
  const accepted = await acceptCake(page);
  const row = await get<Schema["ConsultationAdminOut"]>(
    admin.api,
    `/admin/consultations/${accepted.id}`,
  );
  expect(row.gallery_item?.id).toBe(id);
  expect(row).toMatchObject({ name: name("cakes", "like"), email: email("like"), design: null });
  await admin.page.goto(`/admin/consultations/${accepted.id}`, { waitUntil: "domcontentloaded" });
  await expect(admin.page.getByText(new RegExp(quote(accepted.number))).first()).toBeVisible();
});
