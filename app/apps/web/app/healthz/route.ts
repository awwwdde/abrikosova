/**
 * Проверка живости для платформы-хостинга (deploy/README.md): отвечает 200, когда
 * подняты и сайт, и API. Платформа ждёт 200 на `/healthz` до 120 секунд после старта.
 *
 * Лёгкая: API спрашивается его `/health` без похода в базу, с таймаутом 2 секунды,
 * без кэша. API ещё не поднялся (миграции) — 503, платформа подождёт.
 */

export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000/api/v1";

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`api ${response.status}`);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "starting", api: "unavailable" }, { status: 503 });
  }
}
