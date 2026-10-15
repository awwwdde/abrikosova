/**
 * Тело ответа как JSON — без исключения на пустом или оборванном теле (006b).
 *
 * `response.json()` бросает «Unexpected end of JSON input», если тела нет: 204, 401
 * от прокси, ответ, оборванный уходом со страницы. В клиенте админки такая ошибка
 * из `refreshAccess` оставляла экран «Проверяем сессию…» навсегда — вместо входа.
 * Пустое или не-JSON тело — `undefined`, решение принимает вызывающий код.
 */
export async function readJson<T>(response: Response): Promise<T | undefined> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    // Тело не дочиталось (обрыв соединения, уход со страницы)
    return undefined;
  }
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}
