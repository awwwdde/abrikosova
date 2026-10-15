import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUERY,
  apiParams,
  isFinal,
  nextStep,
  parseQuery,
  queryString,
  shortNumber,
  stepIndex,
  tabOf,
} from "./admin-orders";

describe("номер и шаги заказа", () => {
  it("в списке — хвост номера", () => {
    expect(shortNumber("20261001-867DB2")).toBe("867DB2");
    expect(shortNumber("0944")).toBe("0944");
  });

  it("следующий шаг и финальные статусы", () => {
    expect(nextStep("new")).toEqual({ status: "confirmed", label: "Подтвердить" });
    expect(nextStep("ready")).toEqual({ status: "completed", label: "Выдан" });
    expect(nextStep("completed")).toBeNull();
    expect(nextStep("cancelled")).toBeNull();
    expect(isFinal("cancelled")).toBe(true);
    expect(stepIndex("in_progress")).toBe(2);
    expect(stepIndex("cancelled")).toBe(-1);
  });

  it("вкладка для статуса", () => {
    expect(tabOf("in_progress")).toBe("work");
    expect(tabOf("cancelled")).toBe("done");
  });
});

describe("фильтры в адресе", () => {
  it("туда и обратно без потерь", () => {
    const query = {
      ...DEFAULT_QUERY,
      tab: "work" as const,
      period: "custom" as const,
      from: "2026-10-01",
      to: "2026-10-07",
      method: "delivery" as const,
      page: 2,
    };
    const text = queryString(query);
    expect(parseQuery(new URLSearchParams(text))).toEqual(query);
    expect(queryString(DEFAULT_QUERY)).toBe("");
  });

  it("мусор в адресе — значения по умолчанию", () => {
    expect(parseQuery(new URLSearchParams("tab=x&period=year&from=1.10&page=-3"))).toEqual(
      DEFAULT_QUERY,
    );
  });

  it("параметры API: свой диапазон, без страницы для CSV", () => {
    const query = { ...DEFAULT_QUERY, period: "custom" as const, from: "2026-10-01" };
    expect(apiParams(query, 20)).toBe("tab=all&date_from=2026-10-01&page=1&page_size=20");
    expect(apiParams({ ...DEFAULT_QUERY, period: "today" }, 20, true)).toBe("tab=all&period=today");
  });
});
