import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  catalogSearch,
  countSelected,
  hasQueryState,
  parseCatalogQuery,
  sameFilters,
  toggleValue,
} from "./catalog-query";

describe("параметры каталога в адресе", () => {
  it("разбор объекта searchParams Next и URLSearchParams даёт одно и то же", () => {
    const raw = {
      availability: "today",
      dietary: ["low_sugar", "gluten_free"],
      recipient: "kids",
      sort: "price_asc",
      page: "2",
    };
    const fromObject = parseCatalogQuery(raw);
    const fromParams = parseCatalogQuery(
      new URLSearchParams(
        "availability=today&dietary=low_sugar&dietary=gluten_free&recipient=kids&sort=price_asc&page=2",
      ),
    );
    expect(fromObject).toEqual(fromParams);
    // Порядок значений — как в справочнике, а не как в адресе
    expect(fromObject.dietary).toEqual(["gluten_free", "low_sugar"]);
    expect(fromObject).toMatchObject({ availability: "today", sort: "price_asc", page: 2 });
  });

  it("мусор игнорируется, а не роняет страницу", () => {
    const query = parseCatalogQuery({
      availability: "tomorrow",
      dietary: ["vegan", "gluten_free", "gluten_free"],
      occasion: "kids",
      portions: "100500",
      sort: "name",
      page: "abc",
      utm_source: "tg",
    });
    expect(query).toEqual({
      ...EMPTY_FILTERS,
      dietary: ["gluten_free"],
      sort: "today_first",
      page: 1,
    });
    expect(parseCatalogQuery({ page: "-3" }).page).toBe(1);
    expect(parseCatalogQuery({ page: "999" }).page).toBe(20);
    expect(parseCatalogQuery({}).availability).toBe("any");
  });

  it("сборка: значения по умолчанию не пишутся, пустой набор — пустая строка", () => {
    expect(catalogSearch({})).toBe("");
    expect(catalogSearch({ ...EMPTY_FILTERS, sort: "today_first", page: 1 })).toBe("");
    expect(
      catalogSearch({
        availability: "today",
        dietary: ["gluten_free"],
        recipient: ["kids"],
        sort: "price_asc",
        page: 2,
      }),
    ).toBe("?availability=today&dietary=gluten_free&recipient=kids&sort=price_asc&page=2");
  });

  it("туда-обратно без потерь", () => {
    const search = "?availability=preorder&occasion=birthday&occasion=tea&portions=8_15&sort=new";
    expect(catalogSearch(parseCatalogQuery(new URLSearchParams(search)))).toBe(search);
  });

  it("noindex — у адресов с фильтрами, сортировкой или страницей", () => {
    expect(hasQueryState(parseCatalogQuery({}))).toBe(false);
    expect(hasQueryState(parseCatalogQuery({ sort: "today_first" }))).toBe(false);
    expect(hasQueryState(parseCatalogQuery({ sort: "new" }))).toBe(true);
    expect(hasQueryState(parseCatalogQuery({ page: "2" }))).toBe(true);
    expect(hasQueryState(parseCatalogQuery({ recipient: "her" }))).toBe(true);
  });
});

describe("черновик фильтров", () => {
  it("переключение значения и счётчик на кнопке", () => {
    let draft = EMPTY_FILTERS;
    draft = toggleValue(draft, "occasion", "tea");
    draft = toggleValue(draft, "occasion", "birthday");
    expect(draft.occasion).toEqual(["birthday", "tea"]);
    draft = toggleValue(draft, "occasion", "tea");
    expect(draft.occasion).toEqual(["birthday"]);
    expect(countSelected({ ...draft, availability: "today", dietary: ["gluten_free"] })).toBe(3);
    expect(countSelected(EMPTY_FILTERS)).toBe(0);
  });

  it("исходный набор не меняется — отмена черновика возвращает его", () => {
    const applied = { ...EMPTY_FILTERS, recipient: ["her" as const] };
    const draft = toggleValue(applied, "recipient", "kids");
    expect(applied.recipient).toEqual(["her"]);
    expect(draft.recipient).toEqual(["her", "kids"]);
    expect(sameFilters(applied, draft)).toBe(false);
    expect(sameFilters(applied, toggleValue(draft, "recipient", "kids"))).toBe(true);
  });
});
