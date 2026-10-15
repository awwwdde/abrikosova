/**
 * Анимации появления: все тайминги в одном месте (задание 004d).
 *
 * Как устроено:
 * - скрытое начальное состояние задаёт CSS (globals.css, блок «Появление»), и только
 *   при `html.js` и `prefers-reduced-motion: no-preference`. Без JS и при reduce
 *   контент виден сразу, а класс `js` ставит скрипт в <head> до первой отрисовки —
 *   поэтому нет вспышки текста до скрытия;
 * - JS ждёт, пока элемент войдёт в экран (`inView` из Motion, это IntersectionObserver —
 *   он видит и прокрутку Lenis), проигрывает анимацию один раз и ставит `data-shown`:
 *   после этого CSS элемент больше не скрывает, даже если React перерисует его содержимое;
 * - при возврате назад/вперёд по истории скрипт в <head> на 1,5 с ставит
 *   `html.reveal-instant` — всё, что появляется в это время, показывается сразу,
 *   без повторного проигрывания на глазах у пользователя.
 */

// animate — из motion/mini: только WAAPI, без JS-движка пружин. Нам хватает: анимируем
// лишь transform, opacity и clip-path, а полный animate прибавлял к главной ~26 kB
import { inView, type AnimationPlaybackControls, type DOMKeyframesDefinition } from "motion";
import { animate } from "motion/mini";

/** Кривая — токен --ease-out-soft из globals.css. */
export const EASE = [0.2, 0, 0, 1] as const;

export const MOTION = {
  /** Заголовок по строкам: длительность строки и шаг между строками, с. */
  heading: { duration: 0.9, lineStep: 0.08 },
  /** Абзацы, подписи, кнопки: opacity 0→1 и сдвиг снизу. */
  text: { duration: 0.7, afterHeading: 0.15, distance: 16 },
  /** Кнопки — последними в секции. */
  button: { delay: 0.3 },
  /** Фото: маска снизу вверх и зум внутри. */
  image: { duration: 1.1, scaleFrom: 1.08 },
  /** Линия-разделитель слева направо. */
  line: { duration: 0.9 },
  /** Лесенка: шаг и сколько элементов идут по очереди (дальше — одновременно). */
  stagger: { step: 0.08, max: 6 },
  /** Порог: 15 % элемента в экране, нижняя граница экрана поднята на 10 %. */
  viewport: { amount: 0.15, margin: "0px 0px -10% 0px" },
} as const;

export type RevealKind = "text" | "fade" | "image" | "line" | "group";

/** Анимации не нужны: пользователь их отключил или мы вернулись по истории. */
export function shouldSkip(): boolean {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.classList.contains("reveal-instant") ||
    // Страховка из <head> сняла `js` (клиент не успел отметиться за 3 с): контент
    // уже видим, проигрывать появление поверх него нельзя — будет вспышка
    !document.documentElement.classList.contains("js")
  );
}

/**
 * Проигрывает анимацию появления элемента один раз, когда он входит в экран.
 * `play` получает элемент и признак «первый экран» и возвращает анимации; по их
 * окончании ставится `data-shown`. Возвращает функцию отписки.
 *
 * Первый экран не прячем (009, решение 09.10). До гидрации и без JS всё видно:
 * CSS скрывает только элементы с `data-pending`, а его ставит этот код при
 * монтировании — и только тем, что ниже сгиба. Элемент, который уже в первом экране
 * (`top < innerHeight`), показан с первой отрисовки — так его и засчитывает LCP, —
 * и `play(el, true)` анимирует его только сдвигом, без прозрачности и маски.
 *
 * `observe` — за чьим входом в экран следить, если не за самим элементом.
 * Нужно фото: Chrome учитывает в IntersectionObserver собственный clip-path
 * элемента, и фото, полностью скрытое маской, для него «никогда не в экране».
 */
export function onReveal(
  element: Element,
  play: (element: HTMLElement, firstScreen: boolean) => AnimationPlaybackControls[],
  observe: Element = element,
): () => void {
  const el = element as HTMLElement;
  const show = () => el.setAttribute("data-shown", "");
  if (el.hasAttribute("data-shown")) return () => {};

  if (observe.getBoundingClientRect().top < window.innerHeight) {
    if (shouldSkip()) show();
    else Promise.all(play(el, true).map((a) => a.finished)).finally(show);
    return () => {};
  }

  el.setAttribute("data-pending", "");
  return inView(
    observe,
    () => {
      if (shouldSkip()) {
        show();
        return;
      }
      // Без will-change: WAAPI-анимации transform/opacity и так идут на композиторе
      Promise.all(play(el, false).map((a) => a.finished)).finally(show);
    },
    MOTION.viewport,
  );
}

/** Анимация одного элемента с общей кривой. */
export function tween(
  target: Element | Element[],
  keyframes: DOMKeyframesDefinition,
  duration: number,
  delay = 0,
): AnimationPlaybackControls {
  return animate(target, keyframes, { duration, delay, ease: EASE });
}

/** Задержка n-го элемента лесенки: после `max` все идут одновременно. */
export function staggerDelay(index: number, base = 0): number {
  return base + Math.min(index, MOTION.stagger.max - 1) * MOTION.stagger.step;
}
