import { describe, expect, it } from "vitest";
import { readJson } from "./read-json";

describe("readJson", () => {
  it("разбирает JSON-тело", async () => {
    const response = new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
    expect(await readJson<{ access_token: string }>(response)).toEqual({ access_token: "t" });
  });

  it("пустое тело 200, 204 и 401 — undefined, а не исключение", async () => {
    expect(await readJson(new Response("", { status: 200 }))).toBeUndefined();
    expect(await readJson(new Response(null, { status: 204 }))).toBeUndefined();
    expect(await readJson(new Response("  \n", { status: 401 }))).toBeUndefined();
  });

  it("оборванный или не-JSON ответ — undefined", async () => {
    expect(await readJson(new Response('{"access_tok', { status: 200 }))).toBeUndefined();
    expect(await readJson(new Response("<html>502</html>", { status: 502 }))).toBeUndefined();
  });

  it("тело, которое не дочиталось, — undefined", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.error(new TypeError("network error"));
      },
    });
    expect(await readJson(new Response(stream, { status: 200 }))).toBeUndefined();
  });

  it("JSON null остаётся null", async () => {
    expect(await readJson(new Response("null", { status: 200 }))).toBeNull();
  });
});
