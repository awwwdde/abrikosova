"use client";

/**
 * «Фильтры» и панель фильтров каталога (макет 02-filters-open.png, 005b).
 *
 * Выбор внутри панели — черновик: применяется кнопкой «Показать», а крестик,
 * Esc и клик по затемнению его отбрасывают. Числа у значений пересчитываются
 * при каждом изменении черновика — запрос к `/catalog/filters` с задержкой
 * 150 мс, предыдущий отменяется (`AbortController`).
 *
 * Доступность: `role="dialog"` + `aria-modal`, заголовок связан с диалогом,
 * фокус уходит в панель и не выходит из неё, после закрытия возвращается на
 * «Фильтры». Прокрутка страницы на время панели остановлена (Lenis `stop()`),
 * колонки при нехватке высоты прокручиваются сами, а «Показать» всегда внизу.
 *
 * Отступления от макета (отмечены в отчёте 005b): число выбранных на кнопке
 * («Фильтры 2»); затемнение — на весь экран (в макете оно обрывается внизу).
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useLenis } from "@/components/lenis-provider";
import { OptionRow } from "@/components/ui";
import { apiFetch, type CatalogFilters } from "@/lib/api";
import { pluralRu } from "@/lib/format";
import { EMPTY_FILTERS, filterParams, toggleValue, type Filters } from "@/lib/catalog-query";

const RECOUNT_DELAY = 150;

function SlidersIcon() {
  // Phosphor SlidersHorizontal (regular), как требует задание; инлайн — чтобы
  // не тянуть пакет иконок админки в публичную часть ради одного значка
  return (
    <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M40,88H73a32,32,0,0,0,62,0h81a8,8,0,0,0,0-16H135a32,32,0,0,0-62,0H40a8,8,0,0,0,0,16Zm64-24A16,16,0,1,1,88,80,16,16,0,0,1,104,64ZM216,168H199a32,32,0,0,0-62,0H40a8,8,0,0,0,0,16h97a32,32,0,0,0,62,0h17a8,8,0,0,0,0-16Zm-48,24a16,16,0,1,1,16-16A16,16,0,0,1,168,192Z" />
    </svg>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-[32px] last:mb-0">
      <legend className="mb-[6px] text-[13px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

export function FilterPanel({
  buttonRef,
  location,
  applied,
  initial,
  selectedCount,
  onApply,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  location: { category: string | null; subcategory: string | null };
  applied: Filters;
  initial: CatalogFilters | null;
  selectedCount: number;
  onApply: (filters: Filters) => void;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(applied);
  const [counts, setCounts] = useState<CatalogFilters | null>(initial);
  const panel = useRef<HTMLDivElement>(null);
  const lenis = useLenis();
  const reduce = useReducedMotion();

  // Новые применённые фильтры (после «Показать» или «Назад») — свежие числа с сервера
  useEffect(() => setCounts(initial), [initial]);

  const openPanel = () => {
    setDraft(applied);
    setCounts(initial);
    setOpen(true);
  };

  const close = useCallback(() => setOpen(false), []);

  // Пересчёт чисел по черновику: 150 мс тишины, старый запрос отменяется
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = filterParams(draft);
      if (location.category) params.set("category", location.category);
      if (location.subcategory) params.set("subcategory", location.subcategory);
      apiFetch<CatalogFilters>(`/catalog/filters?${params}`, { signal: controller.signal })
        .then(setCounts)
        .catch(() => {
          // Отменённый или упавший запрос: остаются прежние числа
        });
    }, RECOUNT_DELAY);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft, open, location.category, location.subcategory]);

  // Прокрутка страницы стоит, фокус — в панели; после закрытия — на «Фильтры»
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    lenis?.stop();
    // Сразу после монтирования панели, без requestAnimationFrame: в фоновой
    // вкладке кадры не идут, и фокус остался бы на кнопке за затемнением
    panel.current?.querySelector<HTMLElement>("button, input:not([disabled])")?.focus();
    const button = buttonRef.current;
    return () => {
      root.style.overflow = overflow;
      lenis?.start();
      button?.focus();
    };
  }, [open, lenis, buttonRef]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const items = Array.from(
      panel.current.querySelectorAll<HTMLElement>("button, input:not([disabled])"),
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function apply() {
    setOpen(false);
    onApply(draft);
  }

  const list = (
    key: "dietary" | "recipient" | "occasion" | "portions",
    source: "dietary" | "recipients" | "occasions" | "portions",
  ) =>
    (counts?.[source] ?? []).map((option) => (
      <OptionRow
        key={option.value}
        type="checkbox"
        name={key}
        value={option.value}
        label={option.label}
        count={option.count}
        checked={(draft[key] as string[]).includes(option.value)}
        onChange={() => setDraft((current) => toggleValue(current, key, option.value as never))}
      />
    ));

  const slide = reduce ? { opacity: 0 } : { x: "100%" };
  const shown = reduce ? { opacity: 1 } : { x: 0 };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPanel}
        className="flex h-10 items-center gap-[9px] rounded-[2px] border border-ink px-[19px] text-[13px] font-semibold text-ink transition-colors duration-150 hover:border-accent hover:text-accent max-sm:h-11 max-sm:w-full max-sm:justify-center max-sm:border-line max-sm:text-sm max-sm:font-normal"
      >
        <SlidersIcon />
        Фильтры
        {selectedCount > 0 ? (
          <span className="tnum -mr-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] leading-5 text-canvas">
            {selectedCount}
            <span className="sr-only"> выбрано</span>
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="filters"
            className="fixed inset-0 z-50"
            initial={{ opacity: 1 }}
            exit={{ opacity: 1 }}
          >
            <motion.button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className="absolute inset-0 cursor-default bg-ink/[0.43]"
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onKeyDown={onKeyDown}
              data-lenis-prevent
              className="absolute inset-y-0 right-0 flex w-full flex-col bg-canvas md:w-[640px]"
              initial={slide}
              animate={shown}
              exit={slide}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
            >
              <div className="mx-12 flex items-center justify-between border-b border-line pt-[58px] pb-[36px] max-md:mx-4 max-md:pt-5 max-md:pb-4">
                <h2 id={titleId} className="font-display text-[40px] leading-none text-ink">
                  Фильтры
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Закрыть фильтры"
                  className="-mr-2.5 inline-flex size-10 items-center justify-center text-ink transition-colors hover:text-accent"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M1 1l16 16M17 1L1 17" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-12 pt-[32px] pb-6 max-md:px-4">
                <div className="grid gap-x-12 md:grid-cols-2">
                  <div>
                    <Group title="Срок">
                      {(counts?.availability ?? []).map((option) => (
                        <OptionRow
                          key={option.value}
                          type="radio"
                          name="availability"
                          value={option.value}
                          label={option.label}
                          count={option.count}
                          checked={draft.availability === option.value}
                          onChange={() =>
                            setDraft((current) => ({ ...current, availability: option.value }))
                          }
                        />
                      ))}
                    </Group>
                    <Group title="Состав">{list("dietary", "dietary")}</Group>
                    <Group title="Кому">{list("recipient", "recipients")}</Group>
                  </div>
                  <div className="max-md:mt-[32px]">
                    <Group title="Повод">{list("occasion", "occasions")}</Group>
                    <Group title="Порции">{list("portions", "portions")}</Group>
                  </div>
                </div>
                {counts ? null : (
                  <p className="text-sm text-ink-muted">Не удалось загрузить фильтры</p>
                )}
              </div>

              <div className="mx-12 border-t border-line pt-6 pb-[48px] max-md:mx-4 max-md:pb-5">
                <button
                  type="button"
                  onClick={apply}
                  className="flex h-14 w-full items-center justify-center bg-accent text-lg text-canvas uppercase transition-colors duration-150 hover:bg-accent-pressed"
                >
                  Показать
                  {counts ? (
                    <span className="sr-only">
                      {" "}
                      {counts.total} {pluralRu(counts.total, ["товар", "товара", "товаров"])}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(EMPTY_FILTERS)}
                  className="mx-auto mt-[17px] block text-[13px] font-semibold tracking-[0.04em] text-ink uppercase transition-colors hover:text-accent"
                >
                  Сбросить фильтры
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
