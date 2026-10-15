"use client";

/**
 * Окно заявки на торт — правая панель 600 px (008c). Состояние живёт в адресе:
 * `?request=1` — пустое окно «Свой образец», `&design=<slug>` — с дизайном,
 * `&guests=N`, `&filling=<id>` — подставить; `?like=<id>` («Заказать похожий» из
 * «Работ», 009) открывает окно с работой-образцом. Поэтому ссылки из шапки, «Работ»
 * и калькулятора работают без обработчиков на их стороне.
 *
 * Модальное окно: role="dialog", aria-modal, ловушка фокуса, Esc / крестик / подложка
 * закрывают, фокус возвращается на ссылку-источник, страница под окном не
 * прокручивается (Lenis на паузе). Выезд справа; при prefers-reduced-motion — без
 * движения. Окно — в портале поверх шапки. При закрытии из адреса убираются только
 * параметры окна (фильтр `?occasion=` остаётся), без прокрутки наверх.
 */

import { X } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { CakeRequestForm, type Sample } from "@/components/custom-cakes/cake-request-form";
import { useLenis } from "@/components/lenis-provider";
import {
  apiFetch,
  type CakeFilling,
  type ConsultationAccepted,
  type CustomCakeDetail,
  type CustomCakesInfo,
  type GalleryWork,
} from "@/lib/api";
import { typograf } from "@/lib/format";

const WINDOW_PARAMS = ["request", "design", "like", "guests", "filling"];
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Accepted({ result, onClose }: { result: ConsultationAccepted; onClose: () => void }) {
  const steps = [
    result.contact_method === "telegram"
      ? `Напишем в Telegram на ${result.phone_masked} в течение 30 минут`
      : `Позвоним на ${result.phone_masked} в течение 30 минут`,
    "Назовём вес, срок и стоимость, поможем выбрать начинку",
    "Пришлём эскиз, после согласования вносится аванс",
  ];
  return (
    <div
      data-lenis-prevent
      className="min-h-0 flex-1 overflow-y-auto px-6 pt-[31px] pb-10 sm:px-10"
    >
      <p className="text-[14px] leading-5 text-ink-subtle">Заявка № {result.number}</p>
      <p className="mt-[14px] font-display text-[34px] leading-[46px] text-ink">
        {typograf(result.title)}
      </p>
      <ol className="mt-[27px] border-t border-line">
        {steps.map((step, index) => (
          <li key={step} className="flex items-baseline gap-6 border-b border-line py-[20px]">
            <span className="w-4 shrink-0 font-display text-[22px] leading-6 text-accent">
              {index + 1}
            </span>
            <span className="text-[16px] leading-6 text-ink-muted">{typograf(step)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-[20px] text-[14px] leading-5 text-ink-muted">
        Копию заявки пришлём на {result.email_masked}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-[30px] h-[52px] w-[112px] border border-accent text-[15px] font-semibold text-accent transition-colors duration-150 hover:bg-accent hover:text-white"
      >
        Закрыть
      </button>
    </div>
  );
}

export function RequestPanel({
  info,
  fillings,
}: {
  info: CustomCakesInfo | null;
  fillings: CakeFilling[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const lenis = useLenis();
  const open = info !== null && (params.get("request") === "1" || params.has("like"));
  const designSlug = params.get("design");
  const like = params.get("like");
  const guestsParam = Number.parseInt(params.get("guests") ?? "", 10);
  const fillingParam = params.get("filling");

  const [sample, setSample] = useState<Sample | null>(null);
  const [accepted, setAccepted] = useState<ConsultationAccepted | null>(null);
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Образец: дизайн по slug, работа по id или свой; не нашли — свой образец
  useEffect(() => {
    if (!open) {
      setSample(null);
      setAccepted(null);
      return;
    }
    let cancelled = false;
    const own = () => !cancelled && setSample({ kind: "own" });
    if (designSlug) {
      apiFetch<CustomCakeDetail>(`/custom-cakes/${encodeURIComponent(designSlug)}`)
        .then((design) => !cancelled && setSample({ kind: "design", design }))
        .catch(own);
    } else if (like && /^\d+$/.test(like)) {
      apiFetch<GalleryWork>(`/gallery/${like}`)
        .then((work) => !cancelled && setSample({ kind: "work", work }))
        .catch(own);
    } else {
      own();
    }
    return () => {
      cancelled = true;
    };
  }, [open, designSlug, like]);

  // Открытие: запомнить источник фокуса, остановить прокрутку страницы, выехать
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
    lenis?.stop();
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => {
      window.cancelAnimationFrame(frame);
      document.documentElement.style.overflow = overflow;
      lenis?.start();
      setShown(false);
      // Возврат фокуса на ссылку-источник, если она ещё на странице
      const back = opener.current;
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, [open, lenis]);

  useEffect(() => {
    // Фокус — на заголовок окна: скринридер прочтёт «Заявка на торт», рамка не нужна
    if (open && shown && sample) heading.current?.focus({ preventScroll: true });
  }, [open, shown, sample, accepted]);

  const replaceQuery = useCallback(
    (drop: string[], keep: Record<string, string> = {}) => {
      const next = new URLSearchParams(params.toString());
      for (const key of drop) next.delete(key);
      for (const [key, value] of Object.entries(keep)) next.set(key, value);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const close = useCallback(() => replaceQuery(WINDOW_PARAMS), [replaceQuery]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => element.offsetParent !== null || element === document.activeElement,
    );
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    // Заголовок получает начальный фокус, но не входит в обычный Tab-порядок.
    if (event.shiftKey && (active === first || !items.includes(active as HTMLElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!mounted || !open || !info) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div
        aria-hidden="true"
        onClick={close}
        className={`absolute inset-0 bg-night/40 transition-opacity duration-300 motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-title"
        onKeyDown={trapFocus}
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-canvas shadow-[0_0_40px_rgba(26,18,16,0.18)] transition-transform duration-500 ease-out-soft motion-reduce:transition-none sm:w-[calc(100%-48px)] lg:w-[560px] xl:w-[600px] ${
          shown ? "translate-x-0" : "translate-x-full motion-reduce:translate-x-0"
        }`}
      >
        <div className="flex h-[90px] shrink-0 items-center justify-between border-b border-line px-6 sm:px-10">
          <h2
            id="request-title"
            ref={heading}
            tabIndex={-1}
            className="font-display text-[34px] leading-10 text-ink outline-none"
          >
            {accepted ? "Заявка принята" : "Заявка на торт"}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Закрыть окно заявки"
            className="-mr-2 flex size-10 items-center justify-center text-ink transition-colors hover:text-accent"
          >
            <X aria-hidden="true" size={26} weight="light" />
          </button>
        </div>
        {accepted ? (
          <Accepted result={accepted} onClose={close} />
        ) : sample ? (
          <CakeRequestForm
            key={
              sample.kind === "design"
                ? sample.design.slug
                : sample.kind === "work"
                  ? `w${sample.work.id}`
                  : "own"
            }
            info={info}
            fillings={fillings}
            sample={sample}
            initialGuests={Number.isInteger(guestsParam) && guestsParam > 0 ? guestsParam : null}
            initialFilling={fillingParam && /^\d+$/.test(fillingParam) ? fillingParam : null}
            onRemoveSample={() => replaceQuery(["design", "like"], { request: "1" })}
            onAccepted={setAccepted}
          />
        ) : (
          <p role="status" className="px-6 pt-8 text-[15px] text-ink-subtle sm:px-10">
            Загружаем образец…
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
