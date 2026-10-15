/**
 * Отдельным модулем от lib/motion.ts: его импортирует серверный корневой layout,
 * и Motion туда тянуть незачем.
 */
/**
 * Скрипт для <head>, строкой — вставляется через dangerouslySetInnerHTML:
 * - класс `js` до первой отрисовки — включает скрытое начальное состояние анимаций;
 * - `reveal-instant` на 1,5 с при переходе по истории — показ без анимации;
 * - страховка: если через 3 с после DOMContentLoaded клиент не отметился
 *   (`html[data-reveal="ready"]`, ставит RevealReady), класс `js` снимается и CSS
 *   перестаёт прятать контент. Так бывает, когда JS не загрузился — например, старая
 *   вкладка после деплоя получает 404 на чанки, и гидрации нет.
 */
export const REVEAL_READY_TIMEOUT_MS = 3000;

export const REVEAL_BOOT_SCRIPT = `(function(d){var h=d.documentElement,t;h.classList.add("js");addEventListener("popstate",function(){h.classList.add("reveal-instant");clearTimeout(t);t=setTimeout(function(){h.classList.remove("reveal-instant")},1500)});d.addEventListener("DOMContentLoaded",function(){setTimeout(function(){if(h.dataset.reveal!=="ready")h.classList.remove("js")},${REVEAL_READY_TIMEOUT_MS})})})(document)`;
