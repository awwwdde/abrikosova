"use client";

/**
 * Карточка заявки на торт (011e, 008a): шапка с номером «З-…», поводом и датой,
 * клиент с «Позвонить», почтой и способом связи, что выбрано (дизайн или работа,
 * начинка, пожелания, дополнения, получение, ориентир), фото-образцы и статусы
 * «Взять в работу» → «Закрыть».
 *
 * Фото-образцы — закрытые файлы: только через
 * `GET /admin/consultations/{id}/images/{image_id}` с токеном (каждый просмотр
 * пишется в журнал), поэтому в `<img>` идут blob:-адреса, а не ссылки на хранилище.
 * Увеличение — нативный `<dialog>` со стрелками между фото.
 */

import { CalendarBlank, CaretLeft, CaretRight, Phone, UsersThree, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import {
  Avatar,
  Button,
  EmptyState,
  IconButton,
  Notice,
  Skeleton,
  StatusBadge,
  useToast,
} from "@/components/admin/ui";
import { dayMonth, whenLabel } from "@/lib/admin-dashboard";
import { requestActions } from "@/lib/admin-requests";
import {
  ApiError,
  REQUEST_OCCASION_LABELS,
  formatPrice,
  type ConsultationAdmin,
  type ConsultationStatus,
} from "@/lib/api";
import { formatPhone, pluralRu, typograf } from "@/lib/format";

function References({ requestId, imageIds }: { requestId: number; imageIds: number[] }) {
  const { fetchBlob } = useAdminAuth();
  const [sources, setSources] = useState<(string | null)[]>(() => imageIds.map(() => null));
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const urls: string[] = [];
    let cancelled = false;
    imageIds.forEach((imageId, index) => {
      fetchBlob(`/admin/consultations/${requestId}/images/${imageId}`)
        .then((blob) => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setSources((current) => current.map((item, i) => (i === index ? url : item)));
        })
        .catch(() => !cancelled && setFailed(true));
    });
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [fetchBlob, requestId, imageIds]);

  const show = (index: number) => {
    setOpen(index);
    dialogRef.current?.showModal();
  };
  const step = (delta: number) =>
    setOpen((current) => (current + delta + imageIds.length) % imageIds.length);
  const current = sources[open];

  return (
    <>
      {failed ? <Notice tone="amber">Не все фото-образцы загрузились</Notice> : null}
      <ul className="grid grid-cols-3 gap-2">
        {sources.map((src, index) => (
          <li key={imageIds[index]}>
            {src ? (
              <button
                type="button"
                onClick={() => show(index)}
                aria-label={`Увеличить фото-образец ${index + 1} из ${imageIds.length}`}
                className="block aspect-square w-full overflow-hidden rounded-admin-control bg-admin-photo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side"
              >
                {/* blob: от закрытого эндпоинта — next/image его не оптимизирует, и не нужно */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ) : (
              <Skeleton className="aspect-square w-full rounded-admin-control" />
            )}
          </li>
        ))}
      </ul>
      <dialog
        ref={dialogRef}
        aria-label={`Фото-образец ${open + 1} из ${imageIds.length}`}
        className="m-auto max-h-[90dvh] max-w-[min(900px,calc(100vw-32px))] rounded-admin-card bg-admin-card p-3 backdrop:bg-admin-ink/60"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        onKeyDown={(event) => {
          if (imageIds.length < 2) return;
          if (event.key === "ArrowLeft") step(-1);
          if (event.key === "ArrowRight") step(1);
        }}
      >
        <div className="flex items-center justify-between gap-2 pb-2">
          <span className="text-[13px] font-semibold text-admin-muted tabular-nums">
            {open + 1} из {imageIds.length}
          </span>
          <span className="flex gap-1">
            {imageIds.length > 1 ? (
              <>
                <IconButton label="Предыдущее фото" onClick={() => step(-1)}>
                  <CaretLeft size={18} />
                </IconButton>
                <IconButton label="Следующее фото" onClick={() => step(1)}>
                  <CaretRight size={18} />
                </IconButton>
              </>
            ) : null}
            <IconButton label="Закрыть фото" onClick={() => dialogRef.current?.close()}>
              <X size={18} />
            </IconButton>
          </span>
        </div>
        {current ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={current}
            alt={`Фото-образец от клиента, ${open + 1} из ${imageIds.length}`}
            className="max-h-[78dvh] w-auto object-contain"
          />
        ) : null}
      </dialog>
    </>
  );
}

/** Строка «Что выбрано»: подпись слева, значение справа. */
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-t border-admin-line py-2 text-[13.5px] first:border-t-0">
      <dt className="text-admin-muted">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

const money = (value: number) => formatPrice(String(value));

export function RequestCard({
  requestId,
  onStatusChange,
}: {
  requestId: number;
  onStatusChange: (id: number, status: ConsultationStatus) => void;
}) {
  const { authFetch } = useAdminAuth();
  const toast = useToast();
  const [row, setRow] = useState<ConsultationAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ConsultationStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRow(null);
    setError(null);
    authFetch<ConsultationAdmin>(`/admin/consultations/${requestId}`)
      .then((data) => !cancelled && setRow(data))
      .catch(
        (err) =>
          !cancelled &&
          setError(err instanceof ApiError ? err.message : "Не удалось открыть заявку"),
      );
    return () => {
      cancelled = true;
    };
  }, [authFetch, requestId]);

  async function change(status: ConsultationStatus) {
    if (!row) return;
    const previous = row;
    setBusy(status);
    setRow({ ...row, status });
    onStatusChange(row.id, status);
    try {
      await authFetch(`/admin/consultations/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(status === "completed" ? "Заявка закрыта" : "Заявка в работе");
    } catch (err) {
      setRow(previous);
      onStatusChange(previous.id, previous.status);
      toast.error(err instanceof ApiError ? err.message : "Не удалось изменить статус");
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <div className="p-5">
        <Notice role="alert">{error}</Notice>
      </div>
    );
  }
  if (!row) {
    return (
      <div aria-busy="true" aria-label="Загружаем заявку" className="flex flex-col gap-3 p-[22px]">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const phone = formatPhone(row.phone);
  const occasion = row.occasion
    ? REQUEST_OCCASION_LABELS[row.occasion]
    : row.source === "contact_page"
      ? "Вопрос с сайта"
      : "Торт на заказ";
  const actions = requestActions(row.status);
  const now = new Date().toISOString();

  return (
    <article aria-labelledby="request-title" className="flex flex-col">
      <header className="flex flex-col gap-2.5 bg-admin-side px-[22px] pt-[22px] pb-[18px] text-admin-side-ink">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] font-semibold text-admin-side-ink/75">
            Заявка № {row.number ?? row.id} · {whenLabel(row.created_at, now, "ago")}
          </span>
          <StatusBadge kind="consultation" status={row.status} />
        </div>
        <h2 id="request-title" className="font-display text-[34px] leading-none font-normal">
          {occasion}
        </h2>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
          {row.event_date ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarBlank aria-hidden="true" size={17} />
              {dayMonth(row.event_date)}
            </span>
          ) : null}
          {row.guests_count ? (
            <span className="inline-flex items-center gap-1.5">
              <UsersThree aria-hidden="true" size={17} />
              {row.guests_count} {pluralRu(row.guests_count, ["гость", "гостя", "гостей"])}
            </span>
          ) : null}
        </p>
      </header>

      <div className="flex flex-col gap-4 px-[22px] py-[18px]">
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size="lg" />
          <span className="flex min-w-0 grow flex-col gap-0.5">
            <span className="truncate text-[15px] font-bold">{row.name}</span>
            <span className="text-[13.5px] text-admin-muted tabular-nums">{phone.display}</span>
            {row.email ? (
              <a
                href={`mailto:${row.email}`}
                className="truncate text-[13.5px] text-admin-muted underline-offset-2 hover:text-admin-side hover:underline"
              >
                {row.email}
              </a>
            ) : null}
            {row.contact_method ? (
              <span className="text-xs font-semibold text-admin-side">
                {row.contact_method === "telegram"
                  ? "Просит написать в Telegram"
                  : "Просит позвонить"}
              </span>
            ) : null}
          </span>
          <a
            href={phone.href}
            aria-label={`Позвонить: ${phone.display}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-admin-control bg-admin-green-soft text-admin-green transition-transform duration-150 hover:bg-admin-green hover:text-admin-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-side active:translate-y-px"
          >
            <Phone aria-hidden="true" size={19} />
          </a>
        </div>

        {row.source === "custom_cake" && row.number ? (
          <dl className="rounded-admin-control bg-admin-panel px-3.5 py-1.5">
            <Detail label="Образец">
              {row.design ? (
                <Link
                  href={`/admin/custom-cakes?tab=cakes&edit=${row.design.id}`}
                  className="text-admin-side underline-offset-2 hover:underline"
                >
                  {row.design.title}
                </Link>
              ) : row.gallery_item ? (
                <Link
                  href={`/admin/gallery?edit=${row.gallery_item.id}`}
                  className="text-admin-side underline-offset-2 hover:underline"
                >
                  Работа «{row.gallery_item.title}»
                </Link>
              ) : (
                "Свой дизайн"
              )}
            </Detail>
            <Detail label="Начинка">{row.filling?.title ?? "Помогите выбрать"}</Detail>
            {row.extras.length ? (
              <Detail label="Дополнительно">
                {row.extras
                  .map(
                    (extra) =>
                      `${extra.name} — ${extra.price_from ? "от " : ""}${money(extra.price)}`,
                  )
                  .join(", ")}
              </Detail>
            ) : null}
            <Detail label="Получение">
              {row.delivery_method === "delivery" ? "Доставка" : "Самовывоз"}
            </Detail>
            {row.estimate ? (
              <Detail label="Ориентир">
                <span className="tabular-nums">
                  от {money(row.estimate.price_from)} ·{" "}
                  {String(row.estimate.weight_kg).replace(".0", "").replace(".", ",")} кг ·{" "}
                  {row.estimate.tiers} {pluralRu(row.estimate.tiers, ["ярус", "яруса", "ярусов"])}
                </span>
              </Detail>
            ) : null}
          </dl>
        ) : null}

        {row.wishes || row.description ? (
          <div className="rounded-admin-control bg-admin-panel p-3.5 text-[13.5px] leading-normal">
            {row.wishes ? <span className="font-bold">Пожелания к виду: </span> : null}
            {typograf(row.wishes ?? row.description ?? "")}
          </div>
        ) : (
          <p className="text-[13.5px] text-admin-muted">
            Пожеланий нет: клиент оставил только контакты
          </p>
        )}

        {row.image_ids.length ? (
          <div className="flex flex-col gap-2">
            <span className="text-[13.5px] font-bold">Фото-образцы · {row.image_ids.length}</span>
            <References requestId={row.id} imageIds={row.image_ids} />
          </div>
        ) : null}

        <p className="text-xs text-admin-muted">
          Согласие на обработку данных:{" "}
          {row.consent_at ? `получено ${dayMonth(row.consent_at.slice(0, 10))}` : "получено"}
        </p>
      </div>

      {actions.length ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 px-[22px] pb-[22px]">
          {actions.map((action) => (
            <Button
              key={action.status}
              size="lg"
              variant={action.primary ? "primary" : "outline"}
              className="h-12"
              loading={busy === action.status}
              disabled={busy !== null}
              onClick={() => void change(action.status)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="px-[22px] pb-[22px] text-[13.5px] text-admin-muted">
          Заявка закрыта. Если клиент вернулся, это будет новая заявка.
        </p>
      )}
    </article>
  );
}

export function RequestCardEmpty() {
  return (
    <EmptyState
      title="Выберите заявку"
      text="Нажмите на строку слева: здесь откроются клиент, что выбрано и фото-образцы."
    />
  );
}
