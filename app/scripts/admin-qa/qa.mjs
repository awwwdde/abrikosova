/**
 * Визуальный QA админки (задание 011g).
 *
 * Проходит экраны админки в Chromium и Firefox на разных ширинах и масштабах и ищет
 * то, что не ловят ни axe, ни typecheck:
 *   - сдвиг соседей при наведении и фокусе (bounding box всех элементов до и после,
 *     смещение > 0,5px у любого, кто не сам элемент и не его предок/потомок, — баг);
 *   - сдвиг меню при выборе раздела и вкладок при смене вкладки (позиции пунктов
 *     на разных страницах должны совпадать);
 *   - геометрию переключателей (бегунок по центру дорожки, дорожка 42×24) и их
 *     выравнивание по центру строки;
 *   - перенос подписи в кнопках и пунктах меню, обрезанный текст, горизонтальную
 *     прокрутку, разную высоту кнопок и полей в одном ряду;
 *   - axe (доступность, контраст) в окружениях с `axe: true`.
 *
 * Окружение заказчика: Windows, экран 1920 с масштабом 125 % (CSS 1536, DPR 1,25),
 * размер шрифта браузера ~13px вместо 16 — режим `1536@1.25 font13` (системный Chrome
 * с этой настройкой в профиле; QA_CHROME_CHANNEL меняет канал).
 *
 * Запуск (из app/scripts/admin-qa, docker compose с api и web должен работать):
 *   npm install && npm run setup   — один раз: Playwright и его браузеры
 *   npm run qa                     — полный проход
 *   npm run qa:quick               — только окружение заказчика в Chromium
 * Ключи: --browser chromium|firefox, --env <часть имени>, --screen home,catalog,
 * --shots <папка>, --base <url>.
 * Firefox на Windows, если не стартует сам, — в контейнере: см. firefox-server.mjs.
 *
 * Вход — служебная сессия тестовой владелицы из сида: скрипт выпускает её прямо в
 * контейнере api (пароль не нужен и не печатается) и отзывает в конце.
 * Выход: список проблем по экранам и итог; код 1, если найдены сдвиги или ошибки.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium, firefox } from "playwright";

const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "../..");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const BASE = option("--base") ?? "http://localhost:3000";
const QUICK = args.includes("--quick");
const SHOTS = option("--shots");
const ENV_FILTER = option("--env");
const SCREEN_FILTER = option("--screen")?.split(",");
const BROWSERS = (option("--browser") ?? (QUICK ? "chromium" : "chromium,firefox")).split(",");

// --- Окружения ---------------------------------------------------------------

// Manrope не загрузился: широкий системный шрифт — худший случай для переносов
const FALLBACK_FONT =
  ".admin-scope, .admin-scope * { font-family: Verdana, sans-serif !important; }";

const ENVS = [
  { name: "1366", width: 1366, height: 768 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1536", width: 1536, height: 864 },
  { name: "1920", width: 1920, height: 1080 },
  // Экран 1920 при масштабе Windows 125 % и 150 %: CSS-ширина меньше, DPR дробный
  { name: "1536@1.25", width: 1536, height: 864, dpr: 1.25, interact: true, axe: true },
  { name: "1280@1.5", width: 1280, height: 720, dpr: 1.5 },
  { name: "1920@1.25", width: 1920, height: 1080, dpr: 1.25 },
  { name: "1440@2", width: 1440, height: 900, dpr: 2 },
  { name: "1024", width: 1024, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "375", width: 375, height: 812, mobile: true },
  // Размер шрифта браузера 13px — настоящая настройка Chrome (профиль с
  // default_font_size), а не CSS: от неё зависят и rem в стилях, и rem в
  // медиазапросах. Только Chrome из системы — как у заказчика
  {
    name: "1536@1.25 font13",
    width: 1536,
    height: 864,
    dpr: 1.25,
    fontSize: 13,
    interact: !process.env.QA_STATIC,
    axe: true,
  },
  { name: "1366 font13", width: 1366, height: 768, fontSize: 13 },
  { name: "1536 fallback-font", width: 1536, height: 864, css: FALLBACK_FONT, soft: ["truncated"] },
  { name: "1536@1.25 long", width: 1536, height: 864, dpr: 1.25, long: true },
];

// --- Экраны ------------------------------------------------------------------

const SCREENS = [
  { name: "login", url: "/admin/login", anon: true },
  { name: "home", url: "/admin" },
  { name: "orders", url: "/admin/orders" },
  { name: "order", url: "/admin/orders/{order}" },
  { name: "requests", url: "/admin/consultations?tab=all" },
  { name: "request", url: "/admin/consultations/{consultation}?tab=all" },
  { name: "catalog", url: "/admin/catalog", group: "catalog" },
  { name: "sections", url: "/admin/catalog?view=sections", group: "catalog" },
  { name: "product", url: "/admin/catalog/products/{product}" },
  { name: "fillings", url: "/admin/custom-cakes", group: "cakes" },
  { name: "cakes", url: "/admin/custom-cakes?tab=cakes", group: "cakes" },
  { name: "gallery", url: "/admin/gallery" },
  { name: "work", url: "/admin/gallery?edit={gallery}" },
  { name: "reviews", url: "/admin/reviews?tab=all", group: "reviews" },
  { name: "review", url: "/admin/reviews?tab=all&edit={review}" },
  { name: "reviews-pending", url: "/admin/reviews", group: "reviews" },
  { name: "pages-home", url: "/admin/pages?page=home", group: "pages" },
  { name: "pages-about", url: "/admin/pages?page=about", group: "pages" },
  { name: "pages-cakes", url: "/admin/pages?page=custom_cakes", group: "pages" },
  { name: "pages-cakes-calculator", url: "/admin/pages?page=custom_cakes&block=calculator", group: "pages" },
  { name: "pages-contacts", url: "/admin/pages?page=contacts", group: "pages" },
  { name: "pages-gallery", url: "/admin/pages?page=gallery", group: "pages" },
  { name: "users", url: "/admin/users" },
  { name: "journal", url: "/admin/journal" },
  { name: "settings", url: "/admin/settings" },
  { name: "backups", url: "/admin/backups" },
  { name: "profile", url: "/admin/profile" },
];

// Всплывающее: открыть, проверить и снять (только в окружениях с interact)
const POPUPS = [
  {
    name: "bell",
    screen: "home",
    open: (page) => page.getByRole("button", { name: /^Уведомления/ }).click(),
  },
  {
    name: "profile-menu",
    screen: "home",
    open: (page) =>
      page
        .getByRole("button", { name: /^Профиль/ })
        .first()
        .click(),
  },
  {
    name: "search",
    screen: "home",
    open: async (page) => {
      await page.getByRole("combobox", { name: "Поиск по админке" }).fill("мед");
      await page.waitForTimeout(900);
    },
  },
  {
    name: "bulk-dialog",
    screen: "catalog",
    open: async (page) => {
      const boxes = page.getByRole("checkbox", { name: /^Выбрать «/ });
      await boxes.nth(0).check();
      await boxes.nth(1).check();
      await page.getByRole("button", { name: "Скрыть с сайта" }).click();
    },
  },
  {
    name: "delete-dialog",
    screen: "work",
    open: (page) =>
      page
        .getByRole("button", { name: /^Удалить/ })
        .first()
        .click(),
  },
];

// --- Сессия ------------------------------------------------------------------

function python(code) {
  return execFileSync("docker", ["compose", "exec", "-T", "api", "python", "-"], {
    cwd: APP,
    input: code,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
  });
}

function openSession() {
  const out = python(`
import asyncio, json
from sqlalchemy import select
from app.core.db import SessionLocal
from app.models import AdminUser, ConsultationRequest, GalleryItem, Order, Product, Review
from app.models.enums import AdminRole
from app.services import sessions

async def main():
    async with SessionLocal() as db:
        admin = await db.scalar(
            select(AdminUser)
            .where(AdminUser.role == AdminRole.OWNER, AdminUser.is_active.is_(True))
            .order_by(AdminUser.id)
        )
        s = await sessions.create(db, admin, "127.0.0.1", "admin-qa 011g")
        await db.commit()
        first = lambda model: db.scalar(select(model.id).order_by(model.id.desc()).limit(1))
        print(json.dumps({
            "refresh": sessions.issue_tokens(admin, s)[1],
            "session": str(s.id),
            "ids": {
                "order": await first(Order),
                "consultation": await first(ConsultationRequest),
                "product": await first(Product),
                "gallery": await first(GalleryItem),
                "review": await first(Review),
            },
        }))

asyncio.run(main())
`);
  return JSON.parse(out.trim().split("\n").pop());
}

function closeSession(id) {
  python(`
import asyncio, uuid
from app.core.db import SessionLocal
from app.models import AdminSession
from app.services import sessions

async def main():
    async with SessionLocal() as db:
        s = await db.get(AdminSession, uuid.UUID("${id}"))
        if s:
            await sessions.revoke(db, s)
            await db.commit()

asyncio.run(main())
`);
}

// --- Длинные данные: подмена ответов API -----------------------------------

const LONG_NAME =
  "Торт «Шоколадный трюфель с вишней и маскарпоне» для большого семейного праздника";
const LONG_PERSON = "Анна-Мария Константинопольская-Щедрина";

function lengthen(value, key) {
  if (Array.isArray(value)) return value.map((item) => lengthen(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, lengthen(v, k)]));
  }
  if (typeof value === "string" && ["name", "title", "caption", "product_name"].includes(key)) {
    return LONG_NAME.slice(0, 80);
  }
  if (typeof value === "string" && ["customer_name", "author_name", "client_name"].includes(key)) {
    return LONG_PERSON.slice(0, 40);
  }
  if (
    typeof value === "number" &&
    ["total", "subtotal", "revenue", "amount", "sum"].includes(key)
  ) {
    return 12345678;
  }
  return value;
}

async function routeLong(context) {
  await context.route("**/api/v1/admin/**", async (route) => {
    let response;
    try {
      response = await route.fetch();
    } catch {
      // API оборвал соединение (страница закрылась, перезапуск) — обрываем и запрос
      // страницы, а не роняем весь прогон
      return route.abort().catch(() => {});
    }
    const type = response.headers()["content-type"] ?? "";
    if (!type.includes("json") || route.request().method() !== "GET") {
      return route.fulfill({ response });
    }
    let body = await response.json();
    if (route.request().url().includes("/admin/counters")) {
      body = Object.fromEntries(
        Object.entries(body).map(([k, v]) => [k, typeof v === "number" ? 150 : v]),
      );
    } else {
      body = lengthen(body, "");
    }
    return route.fulfill({ response, json: body });
  });
}

// --- Проверки внутри страницы -------------------------------------------------

/** Статические проверки: выполняется в странице, возвращает список проблем. */
function pageChecks() {
  const issues = [];
  const visible = (el) => {
    if (!el.checkVisibility()) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const label = (el) =>
    (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.tagName)
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 50);
  const lines = (el) => {
    // Видимый текст: подписи для скринридера (sr-only) лежат вне потока и не строка
    const tops = new Set();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || node.parentElement.closest(".sr-only")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width > 1) tops.add(Math.round(rect.top + rect.height / 2));
      }
    }
    // Строки дальше друг от друга, чем на 6px, — разные
    return [...tops].sort((a, b) => a - b).filter((t, i, a) => i === 0 || t - a[i - 1] > 6).length;
  };

  // 1. Горизонтальная прокрутка страницы
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 0.5) {
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 0.5 && visible(el))
      .slice(-1)[0];
    issues.push({
      kind: "hscroll",
      text: `горизонтальная прокрутка: ${doc.scrollWidth} > ${doc.clientWidth}${wide ? ` (${wide.tagName.toLowerCase()}.${String(wide.className).slice(0, 60)})` : ""}`,
    });
  }

  // 2. Меню: одна высота, подпись в одну строку и без многоточия, счётчик на одном x
  const navItems = [...document.querySelectorAll('nav[aria-label="Разделы админки"] a')].filter(
    visible,
  );
  const pillOffsets = new Set();
  for (const a of navItems) {
    const r = a.getBoundingClientRect();
    if (Math.abs(r.height - 44) > 0.5) {
      issues.push({
        kind: "nav",
        text: `пункт «${label(a)}» высотой ${r.height.toFixed(2)} вместо 44`,
      });
    }
    const text = a.querySelector(".truncate");
    if (text && text.scrollWidth > text.clientWidth + 0.5) {
      issues.push({ kind: "truncated", text: `подпись меню «${a.title}» обрезана многоточием` });
    }
    if (text && lines(text) > 1)
      issues.push({ kind: "wrap", text: `подпись меню «${a.title}» в две строки` });
    const pill = a.querySelector(".rounded-full");
    if (pill) pillOffsets.add((r.right - pill.getBoundingClientRect().right).toFixed(1));
  }
  if (pillOffsets.size > 1) {
    issues.push({
      kind: "nav",
      text: `счётчики меню на разном отступе от края пункта: ${[...pillOffsets].join(", ")}`,
    });
  }

  // 3. Переключатели: размер, бегунок по центру, в строке — по центру строки
  for (const sw of document.querySelectorAll('button[role="switch"]')) {
    if (!visible(sw)) continue;
    const r = sw.getBoundingClientRect();
    const knob = sw.firstElementChild?.getBoundingClientRect();
    const name = label(sw.closest("div")?.querySelector("label") ?? sw);
    if (Math.abs(r.width - 42) > 0.5 || Math.abs(r.height - 24) > 0.5) {
      issues.push({
        kind: "switch",
        text: `переключатель «${name}» ${r.width.toFixed(2)}×${r.height.toFixed(2)} вместо 42×24`,
      });
    }
    if (knob) {
      const dy = knob.top + knob.height / 2 - (r.top + r.height / 2);
      const left = knob.left - r.left;
      const right = r.right - knob.right;
      if (
        Math.abs(dy) > 0.5 ||
        Math.min(left, right) < 2.5 ||
        knob.top < r.top - 0.25 ||
        knob.bottom > r.bottom + 0.25
      ) {
        issues.push({
          kind: "switch",
          text: `бегунок «${name}» не по центру: dy=${dy.toFixed(2)}, слева ${left.toFixed(2)}, справа ${right.toFixed(2)}`,
        });
      }
    }
  }

  // 4. Выравнивание в строках: одиночные контролы в ячейке — по центру строки ±1px
  const rows = [...document.querySelectorAll("li, tr")].filter((row) => {
    if (!visible(row)) return false;
    const s = getComputedStyle(row);
    return (
      row.tagName === "TR" ||
      ((s.display === "grid" || s.display === "flex") &&
        s.alignItems === "center" &&
        s.flexDirection !== "column")
    );
  });
  for (const row of rows) {
    const s = getComputedStyle(row);
    const rr = row.getBoundingClientRect();
    const top = rr.top + parseFloat(s.paddingTop) + parseFloat(s.borderTopWidth);
    const bottom = rr.bottom - parseFloat(s.paddingBottom) - parseFloat(s.borderBottomWidth);
    const center = (top + bottom) / 2;
    const cells = [...row.children].filter(visible);
    // Строка в несколько этажей (узкий экран): контрол на втором этаже не обязан
    // стоять по центру всей строки — проверяем только однострочные
    const rects = cells.map((cell) => cell.getBoundingClientRect());
    const oneLine =
      rects.length > 1 &&
      Math.max(...rects.map((r) => r.top)) < Math.min(...rects.map((r) => r.bottom)) - 1;
    if (!oneLine) continue;
    for (const cell of cells) {
      const controls = [
        ...cell.querySelectorAll(
          'button[role="switch"], button, input[type="checkbox"], [class*="rounded-full"]',
        ),
      ].filter((el) => visible(el) && el.getBoundingClientRect().height < 48);
      if (controls.length !== 1) continue;
      const c = controls[0].getBoundingClientRect();
      // Ячейка из нескольких строк текста (имя + мета) — не одиночный контрол
      if (cell.getBoundingClientRect().height > c.height + 8) continue;
      const dy = c.top + c.height / 2 - center;
      if (Math.abs(dy) > 1) {
        issues.push({
          kind: "align",
          text: `«${label(controls[0])}» в строке «${label(row).slice(0, 30)}» ниже/выше центра на ${dy.toFixed(2)}px`,
        });
      }
    }
  }

  // 5. Перенос подписи в кнопках
  for (const el of document.querySelectorAll('button, a[class*="rounded"], [role="tab"]')) {
    if (!visible(el) || el.closest('nav[aria-label="Разделы админки"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 56 || !el.textContent.trim()) continue;
    if (lines(el) > 1)
      issues.push({
        kind: "wrap",
        text: `подпись «${label(el)}» переносится в кнопке ${r.width.toFixed(0)}×${r.height.toFixed(0)}`,
      });
  }

  // 6. Обрезанный текст: overflow hidden без многоточия; многоточия — отдельным списком
  for (const el of document.querySelectorAll("main *, header *, dialog *")) {
    if (!visible(el) || !el.childNodes.length) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownText) continue;
    const s = getComputedStyle(el);
    // Запас 2px — выносные элементы букв; sr-only и line-clamp обрезают текст намеренно
    if (el.scrollWidth <= el.clientWidth + 2 || !["hidden", "clip"].includes(s.overflowX)) continue;
    if (el.clientWidth <= 1 || el.closest(".sr-only") || s.webkitLineClamp !== "none") continue;
    if (s.textOverflow === "ellipsis") {
      issues.push({
        kind: "ellipsis",
        text: `многоточие: «${label(el)}» (${el.clientWidth}px из ${el.scrollWidth})`,
      });
    } else {
      issues.push({ kind: "clipped", text: `текст обрезан без многоточия: «${label(el)}»` });
    }
  }

  // 7. Разная высота кнопок и полей в одном ряду
  const controls = [
    ...document.querySelectorAll(
      'button, input:not([type="checkbox"]):not([type="radio"]), select, a[class*="rounded-admin-control"]',
    ),
  ].filter((el) => {
    if (!visible(el) || el.closest("nav, li, tr, dialog:not([open])")) return false;
    const r = el.getBoundingClientRect();
    return (
      r.height >= 32 &&
      r.height <= 56 &&
      r.width > r.height * 1.5 &&
      el.getAttribute("role") !== "switch"
    );
  });
  const groups = new Map();
  for (const el of controls) {
    let group = el.parentElement;
    while (group && group.parentElement && controls.filter((c) => group.contains(c)).length < 2)
      group = group.parentElement;
    if (!group) continue;
    const list = groups.get(group) ?? [];
    list.push(el);
    groups.set(group, list);
  }
  for (const [group, list] of groups) {
    const s = getComputedStyle(group);
    if (!(s.display.includes("flex") && !s.flexDirection.startsWith("column"))) continue;
    // Одна визуальная строка: одинаковый центр ±6px
    const rects = list.map((el) => [el, el.getBoundingClientRect()]);
    const row = rects.filter(
      ([, r]) => Math.abs(r.top + r.height / 2 - (rects[0][1].top + rects[0][1].height / 2)) < 6,
    );
    const heights = new Set(row.map(([, r]) => r.height.toFixed(1)));
    if (row.length > 1 && heights.size > 1) {
      issues.push({
        kind: "height",
        text: `разная высота в ряду: ${row.map(([el, r]) => `«${label(el).slice(0, 24)}» ${r.height.toFixed(1)}`).join(", ")}`,
      });
    }
  }
  return issues;
}

/** Позиции пунктов меню и вкладок: должны совпадать на разных страницах. */
function layoutMarks() {
  const marks = {};
  const add = (key, el) => {
    const r = el.getBoundingClientRect();
    if (r.width && r.height)
      marks[key] = [r.left, r.top, r.width, r.height].map((v) => +v.toFixed(2));
  };
  document.querySelectorAll('nav[aria-label="Разделы админки"] a').forEach((a) => {
    add(`menu ${a.title}`, a);
    a.querySelectorAll("svg, .rounded-full").forEach((el, i) => add(`menu ${a.title} [${i}]`, el));
    // Подпись: левый край, верх и высота. Ширина не сравнивается — жирный активный
    // текст шире среднего, а у активного пункта подписи отдано место до края меню
    const text = a.querySelector(".truncate");
    if (text) {
      const r = text.getBoundingClientRect();
      marks[`menu ${a.title} text`] = [r.left, r.top, 0, r.height].map((v) => +v.toFixed(2));
    }
  });
  // Вкладки — первая навигация в main (список блоков редактора страниц — не вкладки)
  const tabs = document.querySelector("main nav");
  tabs
    ?.querySelectorAll("a, [role=tab]")
    .forEach((a) => add(`tab ${a.textContent.trim().replace(/\d+$/, "")}`, a));
  return marks;
}

const TRACKED =
  "a, button, input, select, textarea, label, h1, h2, h3, li, [role=switch], [role=tab], [role=combobox], [class*=rounded-full]";
const HOVERABLE =
  "a[href], button:not(:disabled), [role=switch], [role=tab], label[for], li[class*=cursor-pointer]";

async function shiftCheck(page) {
  return page.evaluate(
    async ({ tracked, hoverable }) => {
      window.__qaTracked = [...document.querySelectorAll(tracked)];
      window.__qaHover = [...document.querySelectorAll(hoverable)]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight;
        })
        .slice(0, 60);
      return window.__qaHover.length;
    },
    { tracked: TRACKED, hoverable: HOVERABLE },
  );
}

const snapshot = (page) =>
  page.evaluate(() =>
    window.__qaTracked.map((el) => {
      const r = el.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height];
    }),
  );

async function diffAfter(page, index, before) {
  const after = await snapshot(page);
  return page.evaluate(
    ({ index, before, after }) => {
      const target = window.__qaHover[index];
      const out = [];
      window.__qaTracked.forEach((el, i) => {
        if (el === target || el.contains(target) || target.contains(el)) return;
        // Появилось или исчезло (раскрылся список, тултип) — это не сдвиг соседа
        if (!before[i][2] || !before[i][3] || !after[i][2] || !after[i][3]) return;
        const d = Math.max(...before[i].map((v, k) => Math.abs(v - after[i][k])));
        if (d > 0.5)
          out.push(
            `${el.tagName.toLowerCase()} «${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}» на ${d.toFixed(2)}px`,
          );
      });
      const name = (target.getAttribute("aria-label") || target.textContent || target.tagName)
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40);
      return out.length ? { name, moved: out.slice(0, 4), total: out.length } : null;
    },
    { index, before, after },
  );
}

async function interactions(page, report) {
  const count = await shiftCheck(page);
  const neutral = { x: 2, y: page.viewportSize().height - 2 };
  for (let i = 0; i < count; i++) {
    await page.mouse.move(neutral.x, neutral.y);
    await page.waitForTimeout(60);
    const before = await snapshot(page);
    const box = await page.evaluate((i) => {
      const r = window.__qaHover[i].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, i);
    await page.mouse.move(box.x, box.y);
    await page.waitForTimeout(220);
    const hover = await diffAfter(page, i, before);
    if (hover)
      report(
        "shift",
        `наведение на «${hover.name}» сдвигает ${hover.total}: ${hover.moved.join("; ")}`,
      );

    await page.mouse.move(neutral.x, neutral.y);
    await page.waitForTimeout(200);
    const beforeFocus = await snapshot(page);
    await page.keyboard.press("Shift");
    await page.evaluate((i) => window.__qaHover[i].focus({ preventScroll: true }), i);
    await page.waitForTimeout(200);
    const focus = await diffAfter(page, i, beforeFocus);
    if (focus)
      report(
        "shift",
        `фокус на «${focus.name}» сдвигает ${focus.total}: ${focus.moved.join("; ")}`,
      );
    await page.evaluate(() => document.activeElement?.blur());
  }
}

// --- Прогон -------------------------------------------------------------------

const results = [];
let failed = false;

/** next dev компилирует страницу при первом заходе и перезапускается при нехватке
 * памяти — без прогрева первые заходы падают по таймауту, а не из-за вёрстки. */
async function warmUp(ids) {
  for (const screen of SCREENS.filter((s) => !SCREEN_FILTER || SCREEN_FILTER.includes(s.name))) {
    const url = BASE + screen.url.replace(/\{(\w+)\}/g, (_, key) => ids[key]);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await fetch(url, { signal: AbortSignal.timeout(180000) });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
}

async function gotoRetry(page, url) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await page.goto(url, { waitUntil: "load", timeout: 90000 });
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 8000));
    }
  }
}

/**
 * Firefox из Playwright на части Windows-машин не стартует («side-by-side
 * configuration is incorrect» — нет системной библиотеки). Тогда браузер
 * запускается в официальном образе Playwright (firefox-server.mjs), а скрипт
 * подключается к нему: QA_FIREFOX_WS=ws://127.0.0.1:3100/ npm run qa.
 */
async function launch(engine, name) {
  const ws = process.env[`QA_${name.toUpperCase()}_WS`];
  return ws ? engine.connect(ws) : engine.launch();
}

async function run() {
  // Своя сессия на каждое окружение: refresh-токен одноразовый (ротация), и второй
  // контекст с тем же исходным токеном выглядел бы как кража — сессию бы отозвали,
  // а дальше проверялась бы страница входа вместо админки
  const probe = openSession();
  closeSession(probe.session);
  await warmUp(probe.ids);
  for (const browserName of BROWSERS) {
    const engine = browserName === "firefox" ? firefox : chromium;
    const browser = await launch(engine, browserName);
    const envs = ENVS.filter((env) => (QUICK ? env.name === "1536@1.25 font13" : true)).filter(
      (env) => !ENV_FILTER || (args.includes("--env-exact") ? env.name === ENV_FILTER : env.name.includes(ENV_FILTER)),
    );
    for (const env of envs) {
      if (env.fontSize && browserName !== "chromium") continue;
      // Объект, а не значение: runEnv при потере сессии кладёт сюда новую,
      // и закрываем в конце все выпущенные
      const holder = { current: openSession(), issued: [] };
      holder.issued.push(holder.current.session);
      try {
        await runEnv(browser, browserName, env, holder);
      } finally {
        for (const id of holder.issued) closeSession(id);
      }
    }
    await browser.close();
  }
}

async function newContext(browser, browserName, env, session, anon) {
  const options = {
    viewport: { width: env.width, height: env.height },
    deviceScaleFactor: env.dpr ?? 1,
    // isMobile Firefox не поддерживает
    ...(env.mobile && browserName === "chromium" ? { isMobile: true, hasTouch: true } : {}),
    reducedMotion: "reduce",
  };
  let context;
  if (env.fontSize) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-qa-"));
    fs.mkdirSync(path.join(dir, "Default"));
    fs.writeFileSync(
      path.join(dir, "Default", "Preferences"),
      JSON.stringify({ webkit: { webprefs: { default_font_size: env.fontSize } } }),
    );
    context = await chromium.launchPersistentContext(dir, {
      ...options,
      channel: process.env.QA_CHROME_CHANNEL ?? "chrome",
    });
    // Chrome отпускает файлы профиля не сразу — временную папку убираем с повтором
    // и без падения: остаток в %TEMP% не влияет на результат
    context.on("close", () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
      } catch {}
    });
  } else {
    context = await browser.newContext(options);
  }
  if (!anon) {
    await context.addCookies([
      {
        name: "refresh_token",
        value: session.refresh,
        domain: "localhost",
        path: "/api/v1/auth",
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
  }
  if (env.css) {
    await context.addInitScript((css) => {
      const style = document.createElement("style");
      style.textContent = css;
      document.addEventListener("DOMContentLoaded", () => document.head.append(style));
    }, env.css);
  }
  if (env.long) await routeLong(context);
  return context;
}

/**
 * Сессия потеряна (009): refresh-токен одноразовый, и если страницу закрыли, пока
 * браузер обновлял токен, новый токен не сохраняется — следующий экран приходит со
 * старым, сервер видит повторное использование и отзывает сессию (401), админка
 * уводит на вход. Это свойство защиты, а не вёрстки: выпускаем новую сессию, ставим
 * cookie в тот же контекст и повторяем экран один раз. Перевыпуск — предупреждение.
 */
async function reissueSession(context, holder) {
  holder.current = openSession();
  holder.issued.push(holder.current.session);
  await context.addCookies([
    {
      name: "refresh_token",
      value: holder.current.refresh,
      domain: "localhost",
      path: "/api/v1/auth",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
}

async function openAdminScreen(page, url, context, holder, report) {
  await gotoRetry(page, BASE + url);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.waitForSelector("#admin-main", { timeout: 45000 }).catch(() => {});
    if (new URL(page.url()).pathname !== "/admin/login" && (await page.$("#admin-main"))) return;
    if (attempt === 0) {
      report("session", "сессия потеряна (401) — выпущена новая, экран открыт повторно");
      await reissueSession(context, holder);
      await gotoRetry(page, BASE + url);
    }
  }
  // Экран админки должен открыться в админке: если сессию потеряли и перевыпуск не
  // помог, тут была бы страница входа, и проверки молча прошли бы по ней
  throw new Error(
    `экран не открылся (адрес ${new URL(page.url()).pathname}) даже с новой сессией`,
  );
}

async function runEnv(browser, browserName, env, holder) {
  const tag = `${browserName} ${env.name}`;
  const session = holder.current;
  const context = await newContext(browser, browserName, env, session, false);
  const anonContext = await newContext(browser, browserName, env, session, true);
  const marks = {};
  const interact = env.interact && (browserName === "chromium" || env.name === "1536@1.25");

  for (const screen of SCREENS.filter((s) => !SCREEN_FILTER || SCREEN_FILTER.includes(s.name))) {
    const url = screen.url.replace(/\{(\w+)\}/g, (_, key) => session.ids[key]);
    const page = await (screen.anon ? anonContext : context).newPage();
    const issues = [];
    const report = (kind, text) => issues.push({ kind, text });
    page.on("pageerror", (error) => report("error", `ошибка JS: ${error.message}`));
    try {
      if (screen.anon) await gotoRetry(page, BASE + url);
      else await openAdminScreen(page, url, context, holder, report);
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);
      if (env.fontSize) {
        // Настройка шрифта должна реально действовать, иначе проверка ничего не доказывает
        const root = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
        if (root !== `${env.fontSize}px`)
          throw new Error(`шрифт браузера ${root}, а не ${env.fontSize}px`);
      }
      for (const issue of await page.evaluate(pageChecks)) issues.push(issue);
      if (env.axe) {
        // Доступность и контраст (axe) — как в прежних заданиях, теперь в общем проходе
        await page.addScriptTag({ path: AXE });
        const violations = await page.evaluate(async () =>
          // eslint-disable-next-line no-undef
          (await axe.run(document, { resultTypes: ["violations"] })).violations.map(
            (v) => `${v.id} (${v.impact}, ${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`,
          ),
        );
        for (const text of violations) issues.push({ kind: "axe", text });
      }
      marks[screen.name] = { group: screen.group, marks: await page.evaluate(layoutMarks) };
      if (SHOTS) {
        const dir = path.join(SHOTS, `${browserName}-${env.name.replace(/[ @]/g, "_")}`);
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${screen.name}.png`), fullPage: true });
      }
      if (interact && !screen.anon) await interactions(page, report);
      for (const popup of interact ? POPUPS.filter((p) => p.screen === screen.name) : []) {
        // Каждое всплывающее — отдельно: сбой одного не отменяет проверку остальных
        try {
          await gotoRetry(page, BASE + url);
          await page.waitForSelector("#admin-main", { timeout: 45000 });
          await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(1000);
          await popup.open(page);
          await page.waitForTimeout(500);
          for (const issue of await page.evaluate(pageChecks))
            issues.push({ ...issue, text: `[${popup.name}] ${issue.text}` });
          if (SHOTS) {
            const dir = path.join(SHOTS, `${browserName}-${env.name.replace(/[ @]/g, "_")}`);
            await page.screenshot({ path: path.join(dir, `${screen.name}-${popup.name}.png`) });
          }
          await page.keyboard.press("Escape");
        } catch (error) {
          report("error", `[${popup.name}] ${failure(error)}`);
          if (process.env.QA_DEBUG) {
            await page.screenshot({
              path: path.join(process.env.QA_DEBUG, `${screen.name}-${popup.name}-fail.png`),
            });
            const header = await page.evaluate(
              () =>
                document.querySelector("header")?.outerHTML.slice(0, 3000) ??
                document.body.innerText.slice(0, 500),
            );
            fs.writeFileSync(
              path.join(process.env.QA_DEBUG, `${screen.name}-${popup.name}-fail.html`),
              header,
            );
          }
        }
      }
    } catch (error) {
      report("error", failure(error));
    }
    await page.close();
    record(tag, env, screen.name, issues);
  }

  // Меню при выборе раздела и вкладки при смене вкладки: позиции на всех страницах одни
  const shifts = [];
  const compare = (names, prefix) => {
    const base = {};
    for (const name of names) {
      for (const [key, rect] of Object.entries(marks[name]?.marks ?? {})) {
        if (!key.startsWith(prefix)) continue;
        if (!base[key]) base[key] = { name, rect };
        else {
          const d = Math.max(...rect.map((v, i) => Math.abs(v - base[key].rect[i])));
          if (d > 0.5)
            shifts.push(
              `${key}: на «${name}» сдвиг ${d.toFixed(2)}px относительно «${base[key].name}»`,
            );
        }
      }
    }
  };
  compare(
    Object.keys(marks).filter((name) => name !== "login"),
    "menu ",
  );
  for (const group of new Set(
    Object.values(marks)
      .map((m) => m.group)
      .filter(Boolean),
  )) {
    compare(
      Object.keys(marks).filter((name) => marks[name].group === group),
      "tab ",
    );
  }
  record(
    tag,
    env,
    "смена раздела/вкладки",
    shifts.map((text) => ({ kind: "shift", text })),
  );

  await context.close();
  await anonContext.close();
}

/** Первая строка ошибки и строка журнала Playwright с причиной (перекрыт, не найден). */
function failure(error) {
  const lines = error.message.split("\n");
  const why = lines.find((line) =>
    /intercepts|not visible|not stable|resolved to|waiting for/.test(line),
  );
  return `не удалось проверить: ${lines[0]}${why ? ` (${why.replace(/\x1b\[\d+m/g, "").trim()})` : ""}`;
}

// Многоточия — справочно: их видно в отчёте, но на итог не влияют
const INFO = new Set(["ellipsis", "session"]);

function record(tag, env, screen, issues) {
  const unique = [
    ...new Map(issues.map((issue) => [`${issue.kind}${issue.text}`, issue])).values(),
  ];
  const real = unique.filter(
    (issue) => !INFO.has(issue.kind) && !(env.soft ?? []).includes(issue.kind),
  );
  if (real.length) failed = true;
  results.push({ tag, screen, issues: unique, real: real.length });
  const head = `${real.length ? "✗" : "✓"} ${tag} · ${screen}`;
  console.log(
    unique.length
      ? `${head}\n${unique.map((i) => `    ${INFO.has(i.kind) || (env.soft ?? []).includes(i.kind) ? "·" : "!"} [${i.kind}] ${i.text}`).join("\n")}`
      : head,
  );
}

await run();
const total = results.reduce((sum, r) => sum + r.real, 0);
const shiftCount = results.reduce(
  (sum, r) => sum + r.issues.filter((i) => i.kind === "shift").length,
  0,
);
const warnings = results.reduce((sum, r) => sum + r.issues.length - r.real, 0);
console.log(
  `\nПроверено: ${results.length} (экран × окружение × браузер). Проблем: ${total}. Сдвигов: ${shiftCount}.`,
);
// Итог одной строкой (009): ошибки — то, что валит прогон; предупреждения — справочное
// (многоточия, мягкие проверки окружения, перевыпуск сессии)
console.log(`QA: ${results.length} экранов, ошибок ${total}, предупреждений ${warnings}`);
process.exit(failed ? 1 : 0);
