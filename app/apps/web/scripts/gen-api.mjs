/**
 * Генерация типов API из OpenAPI-схемы бэкенда.
 *
 *   npm run gen:api    — перезаписывает lib/api-schema.d.ts
 *   npm run check:api  — генерирует в память и сравнивает с закоммиченным файлом;
 *                        при расхождении выходит с кодом 1 (проверка для CI)
 *
 * Схему берём у запущенного API: адрес — OPENAPI_URL, иначе API_URL без /api/v1
 * плюс /openapi.json (в docker compose это http://api:8000/openapi.json).
 *
 * Зачем генерация: ручные типы в lib/api.ts отстали от бэкенда, и TypeScript
 * об этом не знал — расхождения всплывали только в рантайме (tasks/001-report.md).
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const OUTPUT = fileURLToPath(new URL("../lib/api-schema.d.ts", import.meta.url));

const HEADER = `/**
 * СГЕНЕРИРОВАНО из OpenAPI-схемы бэкенда — руками не править.
 *
 * Обновить:  docker compose exec web npm run gen:api
 * Проверить: docker compose exec web npm run check:api
 *
 * Исходник — Pydantic-схемы app/apps/api/app/schemas. Удобные короткие имена
 * типов — в lib/api.ts.
 */

`;

function schemaUrl() {
  if (process.env.OPENAPI_URL) return process.env.OPENAPI_URL;
  const apiUrl = process.env.API_URL ?? "http://localhost:8000/api/v1";
  return `${apiUrl.replace(/\/api\/v1\/?$/, "")}/openapi.json`;
}

async function generate(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} ответил ${response.status} — API запущен?`);
  }
  const schema = await response.json();
  const ast = await openapiTS(schema, {
    // Поля со значением по умолчанию Pydantic помечает необязательными во входной
    // схеме, но в ответе API они приходят всегда — без этой опции каждое такое
    // поле в ответах стало бы `T | undefined`.
    defaultNonNullable: true,
  });
  return HEADER + astToString(ast);
}

async function main() {
  const check = process.argv.includes("--check");
  const url = schemaUrl();
  const fresh = await generate(url);

  if (!check) {
    await writeFile(OUTPUT, fresh);
    console.log(`lib/api-schema.d.ts обновлён из ${url}`);
    return;
  }

  const committed = await readFile(OUTPUT, "utf8").catch(() => "");
  // Переводы строк не считаем расхождением: на Windows рабочая копия может быть в CRLF
  if (committed.replace(/\r\n/g, "\n") !== fresh) {
    console.error(
      `lib/api-schema.d.ts не совпадает со схемой API (${url}).\n` +
        "Контракт бэкенда изменился — выполните `npm run gen:api`, поправьте типы " +
        "и закоммитьте обновлённый файл.",
    );
    process.exit(1);
  }
  console.log("lib/api-schema.d.ts соответствует схеме API");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
