import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Точечный сброс кэша ISR.
 *
 * Публичные страницы кэшируются на 5 минут, иначе каждый заход бил бы в API.
 * Но после правки в админке владелица должна видеть результат сразу, а не
 * через интервал ревалидации — поэтому бэкенд после каждой мутации дёргает
 * этот маршрут и сбрасывает конкретные пути.
 *
 * Кроме путей — теги (014): ответы `GET /pages/<ключ>` помечены тегом ключа
 * (`cacheTags` в lib/api.ts), и правка контактов сразу видна на всех страницах,
 * которые их читают, включая каждую карточку товара.
 *
 * Маршрут закрыт общим секретом: без него любой желающий мог бы бесконечно
 * сбрасывать кэш и превращать ISR в постоянную нагрузку на API.
 * Сравнение — с постоянным временем, чтобы секрет нельзя было подобрать
 * по времени ответа.
 */

const SECRET = process.env.REVALIDATE_SECRET;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ detail: "Ревалидация не настроена" }, { status: 503 });
  }

  const provided = request.headers.get("x-revalidate-secret") ?? "";
  if (!safeEqual(provided, SECRET)) {
    return NextResponse.json({ detail: "Недействительный секрет" }, { status: 401 });
  }

  let paths: string[] = [];
  let tags: string[] = [];
  try {
    const body = (await request.json()) as { paths?: unknown; tags?: unknown };
    if (Array.isArray(body.tags)) {
      tags = body.tags
        .filter((t): t is string => typeof t === "string" && /^[a-z_]{1,40}$/.test(t))
        .slice(0, 20);
    }
    if (Array.isArray(body.paths)) {
      paths = body.paths
        .filter((p): p is string => typeof p === "string")
        // Только внутренние пути: строка вида "https://..." сбросом кэша не является
        .filter((p) => p.startsWith("/"))
        .slice(0, 50);
    }
  } catch {
    return NextResponse.json({ detail: "Некорректное тело запроса" }, { status: 400 });
  }

  for (const path of paths) {
    revalidatePath(path);
  }
  for (const tag of tags) {
    revalidateTag(tag);
  }

  return NextResponse.json({ revalidated: paths, tags });
}
