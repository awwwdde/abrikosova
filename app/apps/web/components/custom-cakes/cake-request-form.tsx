"use client";

/**
 * Форма окна заявки на торт (008c, кадры «окно с дизайном», «окно со своим
 * образцом», «Состояния»). React Hook Form + Zod, правила — `ConsultationIn`.
 *
 * Образец: выбранный дизайн («Убрать» → свой образец), работа из «Работ»
 * («Заказать похожий») или свои фото (до 5). Ориентир внизу — общий `useEstimate`
 * (`/custom-cakes/estimate`); дополнения API в ориентир не складывает, поэтому они —
 * отдельной строкой «+ дополнения от N ₽».
 *
 * Черновик (кроме файлов и согласия) — в sessionStorage. Отправка — `POST /consultations`
 * multipart; кнопка выключена на время запроса (второй заявки не будет). 422 —
 * по полям, ранняя дата — в поле даты; сетевая ошибка — сообщение, введённое и файлы
 * остаются. Ошибки при отправке — фокус на первое поле с ошибкой.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { Check, RadioPills, TextField } from "@/components/form-fields";
import { GuestsStepper } from "@/components/custom-cakes/guests-stepper";
import { ReferenceUpload } from "@/components/custom-cakes/reference-upload";
import { formatKg, useEstimate } from "@/components/custom-cakes/use-estimate";
import {
  ApiError,
  apiFetch,
  formatPrice,
  imageUrl,
  type CakeFilling,
  type ConsultationAccepted,
  type CustomCakeDetail,
  type CustomCakesInfo,
  type GalleryWork,
} from "@/lib/api";
import { formatPhoneInput } from "@/lib/checkout";
import {
  buildFormData,
  clearDraft,
  makeSchema,
  mapApiField,
  readDraft,
  writeDraft,
  type RequestValues,
} from "@/lib/consultation-form";
import { pluralRu, typograf } from "@/lib/format";
import { reachGoal } from "@/lib/metrika";

export type Sample =
  | { kind: "own" }
  | { kind: "design"; design: CustomCakeDetail }
  | { kind: "work"; work: GalleryWork };

const PREFIX = "request";
const fieldId = (name: string) => `${PREFIX}-${name.replaceAll("_", "-")}`;
/** Порядок полей на экране — для фокуса на первое поле с ошибкой */
const ORDER: (keyof RequestValues)[] = [
  "occasion",
  "event_date",
  "guests",
  "filling_id",
  "wishes",
  "delivery_method",
  "name",
  "phone",
  "email",
  "contact_method",
  "consent_pd",
];

function SampleCard({ sample, onRemove }: { sample: Sample; onRemove: () => void }) {
  if (sample.kind === "own") return null;
  const isDesign = sample.kind === "design";
  const title = isDesign ? sample.design.title : sample.work.caption;
  const image = isDesign ? sample.design.image_key : sample.work.image_key;
  const meta = isDesign
    ? `${sample.design.tiers} ${pluralRu(sample.design.tiers, ["ярус", "яруса", "ярусов"])} · ${sample.design.specs.decoration_label.toLowerCase()}`
    : ["Похожий на работу", sample.work.occasion_label].filter(Boolean).join(" · ");
  const src = imageUrl(image);
  return (
    <div className="flex items-center gap-4 bg-photo p-[14px]">
      <span className="relative h-20 w-16 shrink-0 bg-[#e9e1d2]">
        {src ? <Image src={src} alt="" fill sizes="64px" className="object-cover" /> : null}
      </span>
      <span className="min-w-0 grow">
        <span className="block font-display text-[20px] leading-6 text-ink">{typograf(title)}</span>
        <span className="mt-[6px] block text-[13px] leading-5 text-ink-muted">
          {typograf(meta)}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="self-start pt-[26px] text-[13px] text-ink-subtle underline underline-offset-2 hover:text-accent"
      >
        Убрать<span className="sr-only">: {title}</span>
      </button>
    </div>
  );
}

export function CakeRequestForm({
  info,
  fillings,
  sample,
  initialGuests,
  initialFilling,
  onRemoveSample,
  onAccepted,
}: {
  info: CustomCakesInfo;
  fillings: CakeFilling[];
  sample: Sample;
  initialGuests: number | null;
  initialFilling: string | null;
  onRemoveSample: () => void;
  onAccepted: (result: ConsultationAccepted) => void;
}) {
  const design = sample.kind === "design" ? sample.design : null;
  const minGuests = design?.min_guests ?? 1;
  const schema = useMemo(
    () => makeSchema(info.earliest_date, info.lead_days, minGuests),
    [info.earliest_date, info.lead_days, minGuests],
  );
  const [files, setFiles] = useState<File[]>([]);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const submitPending = useRef(false);

  const {
    control,
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RequestValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onBlur",
    shouldFocusError: false,
    defaultValues: (() => {
      const draft = readDraft() ?? {};
      // Гости: из адреса (калькулятор, страница дизайна) → из черновика → минимум
      // дизайна или 20, как в калькуляторе
      const base = initialGuests ?? (Number(draft.guests) || (design ? design.min_guests : 20));
      return {
        occasion: design?.occasion ?? draft.occasion ?? "",
        event_date: draft.event_date ?? "",
        guests: String(Math.max(base, minGuests)),
        filling_id: initialFilling ?? draft.filling_id ?? "",
        wishes: draft.wishes ?? "",
        extras: draft.extras ?? [],
        delivery_method: draft.delivery_method ?? "pickup",
        name: draft.name ?? "",
        phone: draft.phone ?? "",
        email: draft.email ?? "",
        contact_method: draft.contact_method ?? "call",
        consent_pd: false,
      };
    })(),
  });

  useEffect(() => {
    const subscription = watch((values) => writeDraft(values as Partial<RequestValues>));
    return () => subscription.unsubscribe();
  }, [watch]);

  const guestsText = watch("guests");
  const extras = watch("extras");
  const guests = Number.parseInt(guestsText, 10);
  const guestsValid = Number.isInteger(guests) && guests >= minGuests && guests <= 1000;
  const { result: estimate, error: estimateError } = useEstimate({
    guests: guestsValid ? guests : null,
    design: design?.slug ?? null,
    initial: design && guestsValid && guests === design.estimate.guests ? design.estimate : null,
  });
  const chosenExtras = info.extras.filter((extra) => extras.includes(extra.name));
  const extrasSum = chosenExtras.reduce((sum, extra) => sum + extra.price, 0);
  const extrasFrom = chosenExtras.some((extra) => extra.price_from);

  function focusField(name: keyof RequestValues) {
    const element = document.getElementById(fieldId(name === "guests" ? "guests" : name));
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function onInvalid(found: FieldErrors<RequestValues>) {
    const first = ORDER.find((name) => found[name]);
    if (first) focusField(first);
  }

  const validatedSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setFileProblem(null);
    try {
      const result = await apiFetch<ConsultationAccepted>("/consultations", {
        method: "POST",
        body: buildFormData(
          values,
          {
            designId: design?.id ?? null,
            workId: sample.kind === "work" ? sample.work.id : null,
          },
          files,
        ),
      });
      clearDraft();
      reachGoal("consultation_created");
      onAccepted(result);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setFormError(
          "Нет связи с сервером. Проверьте интернет и отправьте ещё раз — всё введённое и фото на месте",
        );
        return;
      }
      if (err.data && err.data.field === "event_date") {
        setError("event_date", { message: err.message });
        focusField("event_date");
        return;
      }
      if (err.fieldErrors) {
        const fields = Object.entries(err.fieldErrors)
          .map(([field, message]) => [mapApiField(field), message] as const)
          .filter((pair): pair is [keyof RequestValues, string] => pair[0] !== null);
        for (const [field, message] of fields) setError(field, { message });
        const first = ORDER.find((name) => fields.some(([field]) => field === name));
        if (first) {
          focusField(first);
          return;
        }
      }
      if (err.status === 400 || err.status === 413) setFileProblem(err.message);
      else setFormError(err.message);
    }
  }, onInvalid);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // isSubmitting выключает кнопку после рендера. Два submit до этого
    // рендера должны остановиться ещё до асинхронной проверки Zod.
    if (submitPending.current) return;
    submitPending.current = true;
    try {
      await validatedSubmit(event);
    } finally {
      submitPending.current = false;
    }
  }

  const label = "block text-[14px] leading-5 text-ink-subtle";

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div
        data-lenis-prevent
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-6 pb-10 sm:px-10"
      >
        {sample.kind === "own" ? (
          <ReferenceUpload files={files} onChange={setFiles} error={fileProblem} />
        ) : (
          <SampleCard sample={sample} onRemove={onRemoveSample} />
        )}

        <Controller
          control={control}
          name="occasion"
          render={({ field }) => (
            <RadioPills
              id={fieldId("occasion")}
              label="Повод"
              visibleLabel
              value={field.value}
              options={info.occasions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={field.onChange}
              error={errors.occasion?.message}
              compact
              className="mt-[28px]"
            />
          )}
        />

        <div className="mt-[30px] grid gap-x-4 gap-y-6 sm:grid-cols-[252px_auto]">
          <TextField
            idPrefix={PREFIX}
            label="Дата праздника"
            type="date"
            min={info.earliest_date}
            error={errors.event_date?.message}
            {...register("event_date")}
          />
          <div>
            <label htmlFor={fieldId("guests")} className={label}>
              Гостей
            </label>
            <Controller
              control={control}
              name="guests"
              render={({ field }) => (
                <GuestsStepper
                  id={fieldId("guests")}
                  value={field.value}
                  onChange={field.onChange}
                  min={minGuests}
                  invalid={Boolean(errors.guests)}
                  describedBy={errors.guests ? `${fieldId("guests")}-error` : undefined}
                  className="mt-[6px]"
                />
              )}
            />
            {errors.guests ? (
              <p
                id={`${fieldId("guests")}-error`}
                className="mt-[7px] text-[13px] leading-5 text-accent"
              >
                {errors.guests.message}
              </p>
            ) : null}
          </div>
        </div>
        <p aria-live="polite" className="mt-[6px] text-[14px] leading-5 text-ink-muted">
          {estimate ? (
            <>
              Вес около <b className="font-semibold text-ink">{formatKg(estimate.weight_kg)}</b> ·{" "}
              {estimate.tiers} {pluralRu(estimate.tiers, ["ярус", "яруса", "ярусов"])}
            </>
          ) : null}
          {estimateError ? <span className="block text-accent">{estimateError}</span> : null}
        </p>

        <label htmlFor={fieldId("filling_id")} className={`${label} mt-[30px]`}>
          Начинка
        </label>
        <div className="relative mt-[6px]">
          <select
            id={fieldId("filling_id")}
            {...register("filling_id")}
            className={`h-12 w-full appearance-none border border-line bg-surface pr-10 pl-[13px] text-[15px] focus:border-ink focus:outline-none ${
              watch("filling_id") ? "text-ink" : "text-ink-subtle"
            }`}
          >
            <option value="">Помогите выбрать</option>
            {fillings.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 12 8"
            className="pointer-events-none absolute top-1/2 right-[15px] h-2 w-3 -translate-y-1/2 text-ink"
          >
            <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </div>

        <TextField
          idPrefix={PREFIX}
          label="Пожелания к виду"
          multiline
          placeholder="Цвета, надпись, что важно в оформлении"
          error={errors.wishes?.message}
          className="mt-[30px]"
          {...register("wishes")}
        />

        {info.extras.length ? (
          <fieldset className="mt-[32px]">
            <legend className={label}>Дополнительно</legend>
            <Controller
              control={control}
              name="extras"
              render={({ field }) => (
                <ul className="mt-[14px] flex flex-col gap-[27px]">
                  {info.extras.map((extra) => (
                    <li key={extra.name} className="flex items-center justify-between gap-4">
                      <Check
                        id={fieldId(`extra-${extra.name}`).replace(/\s+/g, "-")}
                        checked={field.value.includes(extra.name)}
                        onChange={(on) =>
                          field.onChange(
                            on
                              ? [...field.value, extra.name]
                              : field.value.filter((name) => name !== extra.name),
                          )
                        }
                      >
                        {typograf(extra.name)}
                      </Check>
                      <span className="text-[14px] text-ink-subtle tabular-nums">
                        {extra.price_from ? "от " : ""}
                        {formatPrice(extra.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            />
          </fieldset>
        ) : null}

        <Controller
          control={control}
          name="delivery_method"
          render={({ field }) => (
            <RadioPills
              id={fieldId("delivery_method")}
              label="Получение"
              visibleLabel
              value={field.value}
              options={[
                { value: "pickup", label: "Самовывоз" },
                { value: "delivery", label: "Доставка" },
              ]}
              onChange={field.onChange}
              className="mt-[32px]"
            />
          )}
        />

        <div className="mt-[30px] grid gap-x-4 gap-y-6 sm:grid-cols-2">
          <TextField
            idPrefix={PREFIX}
            label="Имя"
            autoComplete="name"
            error={errors.name?.message}
            {...register("name")}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <TextField
                idPrefix={PREFIX}
                label="Телефон"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7 (900) 000-00-00"
                value={field.value}
                onChange={(event) => field.onChange(formatPhoneInput(event.target.value))}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors.phone?.message}
              />
            )}
          />
          <TextField
            idPrefix={PREFIX}
            label="Почта"
            type="email"
            autoComplete="email"
            wide
            error={errors.email?.message}
            {...register("email")}
          />
        </div>

        <Controller
          control={control}
          name="contact_method"
          render={({ field }) => (
            <RadioPills
              id={fieldId("contact_method")}
              label="Как связаться"
              visibleLabel
              value={field.value}
              options={[
                { value: "call", label: "Позвонить" },
                { value: "telegram", label: "Написать в Telegram" },
              ]}
              onChange={field.onChange}
              className="mt-[30px]"
            />
          )}
        />

        <Controller
          control={control}
          name="consent_pd"
          render={({ field }) => (
            <Check
              id={fieldId("consent_pd")}
              checked={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.consent_pd?.message}
              className="mt-[32px]"
            >
              Согласен на{" "}
              <a
                href="/consent"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-[3px] transition-colors hover:text-accent"
              >
                обработку персональных данных
              </a>{" "}
              по{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-[3px] transition-colors hover:text-accent"
              >
                политике конфиденциальности
              </a>
            </Check>
          )}
        />

        {formError ? (
          <p
            role="alert"
            className="mt-[24px] bg-accent-soft px-4 py-3 text-[14px] leading-5 text-accent"
          >
            {formError}
          </p>
        ) : null}
      </div>

      <div className="flex min-h-[100px] shrink-0 items-center justify-between gap-4 border-t border-line bg-canvas px-6 py-[18px] sm:px-10">
        <div aria-live="polite">
          <p className="text-[13px] leading-5 text-ink-subtle">Ориентир</p>
          <p className="text-[20px] leading-7 font-semibold text-ink tabular-nums">
            {estimate ? `от ${formatPrice(estimate.price_from)}` : "—"}
          </p>
          {chosenExtras.length ? (
            <p className="text-[12px] leading-4 text-ink-subtle">
              + дополнения {extrasFrom ? "от " : ""}
              {formatPrice(extrasSum)}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-[52px] shrink-0 bg-accent px-6 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-accent-pressed disabled:opacity-60"
        >
          {isSubmitting ? "Отправляем…" : "Отправить заявку"}
        </button>
      </div>
    </form>
  );
}
