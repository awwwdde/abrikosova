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
  heading: { duration: 0.55, lineStep: 0.045 },
  /** Абзацы, подписи, кнопки: opacity 0→1 и сдвиг снизу. */
  text: { duration: 0.4, afterHeading: 0.04, distance: 10 },
  /** Кнопки — последними в секции. */
  button: { delay: 0.08 },
  /** Фото: маска снизу вверх и зум внутри. */
  image: { duration: 0.65, scaleFrom: 1.035 },
  /** Линия-разделитель слева направо. */
  line: { duration: 0.45 },
  /** Лесенка: шаг и сколько элементов идут по очереди (дальше — одновременно). */
  stagger: { step: 0.045, max: 4 },
  /** Запускаем до входа в экран, в том числе для высоких секций и футера. */
  viewport: { amount: 0, margin: "0px 0px 96px 0px" },
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

type RevealJob = { observe: Element; start: (firstScreen: boolean) => void };
const revealJobs = new Set<RevealJob>();
let revealFrame: number | null = null;

function flushReveals() {
  revealFrame = null;
  const jobs = Array.from(revealJobs).filter((job) => job.observe.isConnected);
  revealJobs.clear();
  const height = window.innerHeight;
  // Сначала все чтения геометрии, затем все записи: иначе каждый data-pending
  // заставляет браузер заново пересчитывать стили перед следующим измерением.
  const measured = jobs.map((job) => ({
    job,
    firstScreen: job.observe.getBoundingClientRect().top < height,
  }));
  for (const { job, firstScreen } of measured) job.start(firstScreen);
}

/**
 * Проигрывает анимацию появления элемента один раз, когда он входит в экран.
 * `play` получает элемент и признак «первый экран» и возвращает анимации; по их
 * окончании ставится `data-shown`. Возвращает функцию отписки.
 *
 * Первый экран не прячем (009, решение 09.10). До гидрации и без JS всё видно:
 * CSS скрывает только элементы с `data-pending`, а его ставит этот код при
 * монтировании — и только тем, что ниже сгиба. Элемент, который уже в первом экране
 * (`top < innerHeight`), остаётся на месте: поздняя гидрация или загрузка шрифта
 * не запускает повторный сдвиг уже читаемого текста.
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
  if (shouldSkip()) {
    show();
    return () => {};
  }
  let unobserve = () => {};
  const job: RevealJob = {
    observe,
    start(firstScreen) {
      if (firstScreen || shouldSkip()) {
        // Уже читаемый текст не сдвигается после гидрации или загрузки шрифта.
        show();
        return;
      }
      el.setAttribute("data-pending", "");
      unobserve = inView(
        observe,
        () => {
          if (shouldSkip()) {
            show();
            return;
          }
          Promise.all(play(el, false).map((a) => a.finished)).finally(show);
        },
        MOTION.viewport,
      );
    },
  };
  revealJobs.add(job);
  if (revealFrame === null) revealFrame = requestAnimationFrame(flushReveals);
  return () => {
    revealJobs.delete(job);
    unobserve();
    if (revealJobs.size === 0 && revealFrame !== null) {
      cancelAnimationFrame(revealFrame);
      revealFrame = null;
    }
  };
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
