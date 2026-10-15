import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATALOG,
  catalogApiParams,
  catalogQueryString,
  dropItem,
  moveItem,
  parseCatalog,
  sectionText,
} from "./admin-catalog";

describe("фильтры каталога", () => {
  it("туда и обратно", () => {
    const query = {
      ...DEFAULT_CATALOG,
      q: "мед",
      category: "2",
      subcategory: "5",
      stock: "out" as const,
      visibility: "hidden" as const,
      page: 3,
    };
    expect(parseCatalog(new URLSearchParams(catalogQueryString(query)))).toEqual(query);
    expect(catalogQueryString(DEFAULT_CATALOG)).toBe("");
  });

  it("подраздел без раздела отбрасывается", () => {
    expect(parseCatalog(new URLSearchParams("subcategory=5")).subcategory).toBe("");
  });

  it("параметры API", () => {
    const params = catalogApiParams(
      { ...DEFAULT_CATALOG, visibility: "hidden", stock: "today" },
      20,
    );
    expect(params).toBe("page=1&page_size=20&availability=today&is_active=false");
  });
});

describe("разделы и порядок", () => {
  it("одно слово, если подраздел как раздел", () => {
    expect(sectionText("Бенто", "бенто")).toBe("Бенто");
    expect(sectionText("Торты", "Классика")).toBe("Торты · Классика");
  });

  it("стрелки и перетаскивание", () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(dropItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
  });
});
