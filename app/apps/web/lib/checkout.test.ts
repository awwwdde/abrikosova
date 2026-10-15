import { describe, expect, it } from "vitest";
import type { Cart } from "./api";
import {
  CONSENT_ERROR,
  DRAFT_KEY,
  EMAIL_ERROR,
  EMPTY_CHECKOUT,
  checkoutSchema,
  dayShort,
  earliestReasonText,
  formatPhoneInput,
  intervalText,
  keepInterval,
  leadText,
  loadDraft,
  positionsText,
  saveDraft,
  toOrderPayload,
} from "./checkout";

const valid = {
  ...EMPTY_CHECKOUT,
  customer_name: "Анна",
  customer_phone: "+7 (916) 123-45-67",
  customer_email: "anna@mail.ru",
  desired_date: "2026-10-09",
  delivery_interval: "12-15",
  consent_pd: true,
};

function errors(values: object): Record<string, string> {
  const result = checkoutSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

describe("маска телефона", () => {
  it("по мере ввода", () => {
    expect(formatPhoneInput("9")).toBe("+7 (9");
    expect(formatPhoneInput("916")).toBe("+7 (916)");
    expect(formatPhoneInput("89161234567")).toBe("+7 (916) 123-45-67");
    expect(formatPhoneInput("+7 916 123 45 67 89")).toBe("+7 (916) 123-45-67");
    expect(formatPhoneInput("")).toBe("");
  });
});

describe("схема формы — как OrderCreate", () => {
  it("тексты ошибок с макета", () => {
    expect(errors({ ...valid, customer_name: " " }).customer_name).toBe("Укажите имя");
    expect(errors({ ...valid, customer_email: "anna@" }).customer_email).toBe(EMAIL_ERROR);
    expect(errors({ ...valid, consent_pd: false }).consent_pd).toBe(CONSENT_ERROR);
  });

  it("дата и окно обязательны всегда, адрес — при доставке, получатель — при галочке", () => {
    const e = errors({
      ...valid,
      desired_date: "",
      delivery_interval: "",
      delivery_method: "delivery",
      other_recipient: true,
      recipient_phone: "+7 (9",
    });
    expect(Object.keys(e).sort()).toEqual([
      "delivery_address",
      "delivery_interval",
      "desired_date",
      "recipient_name",
      "recipient_phone",
    ]);
    expect(errors(valid)).toEqual({});
  });

  it("при самовывозе адресные поля не уходят в заказ", () => {
    const payload = toOrderPayload(
      { ...valid, delivery_address: "Гжатская, 5", courier_comment: "домофон" },
      "",
    );
    expect(payload.delivery_address).toBeNull();
    expect(payload.courier_comment).toBeNull();
    expect(payload.recipient_name).toBeNull();
    expect(payload.website).toBeNull();
  });
});

describe("черновик формы", () => {
  it("без согласия и чужих ключей; битый — пустой", () => {
    const storage = new MemoryStorage() as unknown as Storage;
    saveDraft({ ...valid, customer_comment: "после 18" }, storage);
    expect(JSON.parse(storage.getItem(DRAFT_KEY)!)).not.toHaveProperty("consent_pd");
    const draft = loadDraft(storage);
    expect(draft.customer_comment).toBe("после 18");
    expect(draft.consent_pd).toBeUndefined();

    storage.setItem(DRAFT_KEY, '{"customer_name": 5, "hack": "x"}');
    expect(loadDraft(storage)).toEqual({});
    storage.setItem(DRAFT_KEY, "{не json");
    expect(loadDraft(storage)).toEqual({});
    expect(loadDraft(null)).toEqual({});
  });
});

describe("подписи", () => {
  it("даты, окна, позиции, срок", () => {
    expect(dayShort("2026-10-09")).toBe("9 окт");
    expect(intervalText("09-12")).toBe("9:00–12:00");
    expect(positionsText(3)).toBe("3 позиции");
    expect(positionsText(5)).toBe("5 позиций");
    expect(leadText(0)).toEqual({ text: "Можно забрать сегодня", ready: true });
    expect(leadText(2)).toEqual({ text: "Под заказ за 2 дня", ready: false });
  });

  it("причина ранней даты", () => {
    expect(
      earliestReasonText({
        earliest_date: "2026-10-09",
        earliest_reason: {
          name: "Три шоколада",
          variant_label: "1,4 кг",
          has_variants: false,
          lead_time_days: 2,
        },
      }),
    ).toBe("Три шоколада, 1,4 кг готовится 2 дня, поэтому весь заказ можно получить с 9 октября");
    expect(earliestReasonText({ earliest_date: "2026-10-09", earliest_reason: null })).toBeNull();
  });

  it("смена способа сбрасывает окно, которого у него нет", () => {
    const day = (intervals: string[]) => ({
      date: "2026-10-09",
      label: "Пт",
      available: true,
      intervals: intervals.map((interval) => ({ interval, available: true })),
    });
    const cart = {
      slots: {
        pickup: [day(["09-12", "12-15", "15-18", "18-21"])],
        delivery: [day(["09-12", "12-15", "15-18"])],
      },
    } as unknown as Pick<Cart, "slots">;
    expect(keepInterval(cart, "delivery", "2026-10-09", "18-21")).toEqual({
      interval: "",
      dropped: true,
    });
    expect(keepInterval(cart, "delivery", "2026-10-09", "12-15")).toEqual({
      interval: "12-15",
      dropped: false,
    });
  });
});
