import { describe, expect, it } from "vitest";
import { cacheTags } from "./api";

describe("теги кэша (014)", () => {
  it("страницы контента — тег ключа, разделы — categories", () => {
    expect(cacheTags("/pages/contacts")).toEqual(["contacts"]);
    expect(cacheTags("/pages/custom_cakes")).toEqual(["custom_cakes"]);
    expect(cacheTags("/catalog/categories")).toEqual(["categories"]);
  });
  it("«Торты на заказ» — тег страницы контента custom_cakes (008b)", () => {
    expect(cacheTags("/custom-cakes")).toEqual(["custom_cakes"]);
    expect(cacheTags("/custom-cakes?occasion=kids")).toEqual(["custom_cakes"]);
    expect(cacheTags("/custom-cakes/info")).toEqual(["custom_cakes"]);
    expect(cacheTags("/custom-cakes-old")).toEqual([]);
  });
  it("остальное — без тегов", () => {
    expect(cacheTags("/catalog/products?availability=today")).toEqual([]);
    expect(cacheTags("/pages")).toEqual([]);
    expect(cacheTags("/catalog/categories/torty")).toEqual([]);
  });
});
