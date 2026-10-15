import { describe, expect, it } from "vitest";
import {
  buildFormData,
  fileError,
  leadDaysError,
  makeSchema,
  mapApiField,
  type RequestValues,
} from "./consultation-form";

const VALID: RequestValues = {
  occasion: "wedding",
  event_date: "2026-10-20",
  guests: "40",
  filling_id: "",
  wishes: "  Белые пионы ",
  extras: ["Свечи", "Открытка"],
  delivery_method: "pickup",
  name: "Анна",
  phone: "+7 (916) 123-45-67",
  email: "anna@mail.ru",
  contact_method: "call",
  consent_pd: true,
};

describe("окно заявки на торт (008c): правила формы", () => {
  const schema = makeSchema("2026-10-19", 5, 40);

  it("валидная заявка проходит", () => {
    expect(schema.safeParse(VALID).success).toBe(true);
  });

  it("тексты ошибок — с кадра «Состояния»", () => {
    const result = schema.safeParse({
      ...VALID,
      occasion: "",
      event_date: "2026-10-18",
      guests: "39",
      phone: "+7 (916)",
      consent_pd: false,
    });
    expect(result.success).toBe(false);
    const messages = Object.fromEntries(
      (result.error?.issues ?? []).map((issue) => [issue.path[0], issue.message]),
    );
    expect(messages).toMatchObject({
      occasion: "Выберите повод",
      event_date: "Выберите дату не раньше чем через 5 дней",
      guests: "Гостей — от 40",
      phone: "Укажите телефон",
      consent_pd: "Отметьте согласие",
    });
  });

  it("склонение срока", () => {
    expect(leadDaysError(1)).toBe("Выберите дату не раньше чем через 1 день");
    expect(leadDaysError(3)).toBe("Выберите дату не раньше чем через 3 дня");
  });
});

describe("файлы и тело запроса", () => {
  it("тип по MIME или расширению (HEIC без MIME), до 10 МБ", () => {
    expect(fileError(new File(["x"], "IMG_0001.HEIC", { type: "" }))).toBeNull();
    expect(fileError(new File(["x"], "photo.jpg", { type: "image/jpeg" }))).toBeNull();
    expect(fileError(new File(["x"], "doc.pdf", { type: "application/pdf" }))).toMatch(/JPEG/);
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    expect(fileError(big)).toMatch(/10 МБ/);
  });

  it("multipart: поля API, дополнения повторяются, без согласия-ловушки", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const form = buildFormData(VALID, { designId: 3, workId: null }, [file]);
    expect(form.get("guests_count")).toBe("40");
    expect(form.get("wishes")).toBe("Белые пионы");
    expect(form.getAll("extras")).toEqual(["Свечи", "Открытка"]);
    expect(form.get("design_id")).toBe("3");
    expect(form.has("gallery_item_id")).toBe(false);
    expect(form.has("filling_id")).toBe(false);
    expect(form.getAll("references")).toHaveLength(1);
  });

  it("ошибки API раскладываются по полям формы", () => {
    expect(mapApiField("guests_count")).toBe("guests");
    expect(mapApiField("email")).toBe("email");
    expect(mapApiField("references.0")).toBeNull();
  });
});
