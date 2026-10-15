import { describe, expect, it } from "vitest";
import {
  greeting,
  intervalLabel,
  localParts,
  longDate,
  monthGrid,
  monthTitle,
  offsetMinutes,
  percentChange,
  periodLabel,
  shiftMonth,
  shortName,
  topShares,
  weekdayDayMonth,
  whenLabel,
} from "./admin-dashboard";

describe("даты главной", () => {
  it("день кондитерской не сдвигается часовым поясом браузера", () => {
    expect(longDate("2026-10-01")).toBe("Четверг, 1 октября");
    expect(weekdayDayMonth("2026-10-02")).toBe("Пт, 2 октября");
    expect(monthTitle("2026-10")).toBe("Октябрь 2026");
  });

  it("период недели — одним месяцем короче", () => {
    expect(periodLabel("2026-09-23", "2026-09-29")).toBe("23–29 сентября");
    expect(periodLabel("2026-09-25", "2026-10-01")).toBe("25 сентября – 1 октября");
  });

  it("время события — по часам кондитерской", () => {
    const now = "2026-10-01T12:00:00+03:00";
    expect(offsetMinutes(now)).toBe(180);
    // 21:30 UTC 30 сентября — это 00:30 по Москве 1 октября
    expect(localParts("2026-09-30T21:30:00Z", 180)).toEqual({ day: "2026-10-01", time: "00:30" });
    expect(whenLabel("2026-09-30T21:30:00Z", now)).toBe("00:30");
    expect(whenLabel("2026-09-30T20:30:00Z", now)).toBe("вчера");
    expect(whenLabel("2026-10-01T07:00:00Z", now, "ago")).toBe("2 ч назад");
    expect(whenLabel("2026-09-20T10:00:00Z", now)).toBe("20 сентября");
  });

  it("приветствие по часам кондитерской", () => {
    expect(greeting("2026-10-01T09:00:00+03:00")).toBe("Доброе утро");
    expect(greeting("2026-10-01T14:00:00+03:00")).toBe("Добрый день");
    expect(greeting("2026-10-01T23:30:00+03:00")).toBe("Доброй ночи");
  });

  it("календарь — полные недели с понедельника", () => {
    const weeks = monthGrid("2026-10");
    // 1 октября 2026 — четверг: понедельник–среда пустые
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("подписи и доли", () => {
  it("процент к прошлому периоду", () => {
    expect(percentChange(48300, 43125)).toBe(12);
    expect(percentChange(5, 0)).toBeNull();
  });

  it("интервал и короткое имя", () => {
    expect(intervalLabel("09-12")).toBe("09:00–12:00");
    expect(intervalLabel(null)).toBe("Время не выбрано");
    expect(shortName("Мария Смирнова")).toBe("Мария С.");
    expect(shortName("Игорь")).toBe("Игорь");
  });

  it("доли — три крупнейшие и «Остальное», сумма 100", () => {
    const shares = topShares([
      { name: "Торты", items: 10 },
      { name: "Бенто", items: 5 },
      { name: "Пироги", items: 3 },
      { name: "Печенье", items: 2 },
      { name: "Наборы", items: 1 },
    ]);
    expect(shares.map((s) => s.name)).toEqual(["Торты", "Бенто", "Пироги", "Остальное"]);
    expect(shares.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
    expect(topShares([])).toEqual([]);
  });
});
