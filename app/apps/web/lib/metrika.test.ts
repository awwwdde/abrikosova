import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { goalForHref, hasConsent } from "./metrika";

describe("цели Метрики", () => {
  it("телефон и Telegram узнаются по ссылке", () => {
    expect(goalForHref("tel:+79623522277")).toBe("phone_click");
    expect(goalForHref("https://t.me/abricosova_elena")).toBe("telegram_click");
    expect(goalForHref("https://vk.com/")).toBeNull();
    expect(goalForHref("/catalog")).toBeNull();
    expect(goalForHref(null)).toBeNull();
  });

  it("согласие — только cookie analytics_consent=1", () => {
    expect(hasConsent("cart_id=abc; analytics_consent=1")).toBe(true);
    expect(hasConsent("analytics_consent=0")).toBe(false);
    expect(hasConsent("")).toBe(false);
  });
});

const ROOT = path.resolve(__dirname, "..");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}
const usesAnalytics = (file: string) =>
  /components\/analytics|lib\/metrika/.test(readFileSync(file, "utf8"));

describe("Метрики нет в админке", () => {
  it("ни один файл админки и корневой layout не подключают счётчик", () => {
    const admin = [
      ...files(path.join(ROOT, "app", "admin")),
      ...files(path.join(ROOT, "components", "admin")),
      path.join(ROOT, "app", "layout.tsx"),
    ];
    expect(admin.filter(usesAnalytics)).toEqual([]);
  });

  it("счётчик ставит только каркас публичных страниц", () => {
    const owners = files(path.join(ROOT, "app"))
      .concat(files(path.join(ROOT, "components")))
      .filter((file) => /components\/analytics/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(ROOT, file).split(path.sep).join("/"));
    expect(owners).toEqual(["components/public-shell.tsx"]);
  });
});
