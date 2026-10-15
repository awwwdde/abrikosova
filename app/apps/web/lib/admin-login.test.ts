import { describe, expect, it } from "vitest";
import {
  PHOTO_SLOT_MS,
  formatCountdown,
  msUntilNextSlot,
  photoIndexAt,
  safeNextPath,
  shuffleForDay,
} from "./admin-login";

describe("safeNextPath", () => {
  it("пропускает пути внутри админки с параметрами", () => {
    expect(safeNextPath("/admin/orders?status=new#top")).toBe("/admin/orders?status=new#top");
    expect(safeNextPath("/admin")).toBe("/admin");
  });

  const rejected: [string | null, string][] = [
    ["https://evil.example/admin", "внешний адрес"],
    ["//evil.example/admin", "протокол-относительный адрес"],
    ["/\\evil.example", "обратный слэш"],
    ["javascript:alert(1)", "javascript:"],
    ["/catalog", "путь вне админки"],
    ["/administrator", "похожий префикс"],
    ["/admin/login", "сам вход"],
    ["/admin/../catalog", "выход из /admin через .."],
    ["", "пустой"],
    [null, "нет параметра"],
  ];

  it.each(rejected)("отклоняет %s (%s)", (next) => {
    expect(safeNextPath(next)).toBe("/admin");
  });
});

describe("фото страницы входа", () => {
  const photos = ["a", "b", "c", "d", "e", "f"];
  const day = Date.UTC(2026, 9, 1, 12);

  it("в течение суток порядок один и тот же, на другой день — другой", () => {
    expect(shuffleForDay(photos, day)).toEqual(shuffleForDay(photos, day + 3 * 3600 * 1000));
    expect(shuffleForDay(photos, day)).not.toEqual(shuffleForDay(photos, day + 24 * 3600 * 1000));
    expect([...shuffleForDay(photos, day)].sort()).toEqual(photos);
  });

  it("в пределах слота индекс не меняется, на границе — меняется", () => {
    const slotStart = Math.floor(day / PHOTO_SLOT_MS) * PHOTO_SLOT_MS;
    expect(photoIndexAt(6, slotStart)).toBe(photoIndexAt(6, slotStart + PHOTO_SLOT_MS - 1));
    expect(photoIndexAt(6, slotStart + PHOTO_SLOT_MS)).not.toBe(photoIndexAt(6, slotStart));
    expect(photoIndexAt(0, day)).toBe(-1);
  });

  it("таймер — ровно до границы слота", () => {
    const slotStart = Math.floor(day / PHOTO_SLOT_MS) * PHOTO_SLOT_MS;
    expect(msUntilNextSlot(slotStart + 1000)).toBe(PHOTO_SLOT_MS - 1000);
  });
});

describe("formatCountdown", () => {
  it("минуты и секунды с ведущим нулём", () => {
    expect(formatCountdown(899)).toBe("14:59");
    expect(formatCountdown(5)).toBe("0:05");
    expect(formatCountdown(-3)).toBe("0:00");
  });
});
