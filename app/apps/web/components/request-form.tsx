"use client";

import { useState } from "react";
import { Button, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { reachGoal } from "@/lib/metrika";

/**
 * Поля формы в multipart/form-data.
 *
 * Пустые значения не отправляем вовсе: в форме нет способа передать null,
 * а пустая строка для FastAPI — это значение, и необязательное поле
 * (например, дата) провалило бы валидацию. Content-Type с boundary браузер
 * выставит сам — apiFetch не ставит заголовок, если тело не строка.
 */
function toFormData(fields: Record<string, string | boolean | null>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === "") continue;
    data.append(key, String(value));
  }
  return data;
}

/**
 * Общая форма заявки: используется и на «Тортах на заказ», и на «Контактах».
 * Одна реализация вместо копии на каждой странице — в старом проекте JS-логика
 * форм дублировалась инлайново в каждом шаблоне.
 */
export function RequestForm({
  endpoint,
  messageField,
  messageLabel,
  messagePlaceholder,
  submitLabel,
  bodyFormat = "json",
}: {
  endpoint: string;
  messageField: "description" | "message";
  messageLabel: string;
  messagePlaceholder?: string;
  submitLabel: string;
  /**
   * Формат тела запроса. Заявка на торт — multipart/form-data: вместе с полями
   * может ехать фото-референс (поля для него — задание 007). Обратная связь — JSON.
   */
  bodyFormat?: "json" | "multipart";
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [commonError, setCommonError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setCommonError(null);

    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Укажите имя";
    if (!/^\+?[\d\s\-()]{7,20}$/.test(phone.trim())) next.phone = "Укажите телефон";
    if (!consent) next.consent_pd = "Без согласия заявку принять нельзя";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus("sending");
    try {
      const fields = {
        name: name.trim(),
        phone: phone.trim(),
        [messageField]: message.trim() || null,
        consent_pd: consent,
        website: website || null,
      };
      await apiFetch(endpoint, {
        method: "POST",
        body: bodyFormat === "multipart" ? toFormData(fields) : JSON.stringify(fields),
      });
      setStatus("sent");
      // Цель только для заявки на торт; форма обратной связи на контактах — не она
      if (endpoint.includes("consultation")) reachGoal("custom_cake_request");
    } catch (error) {
      setStatus("idle");
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      setCommonError(
        error instanceof ApiError ? error.message : "Не удалось отправить заявку, попробуйте позже",
      );
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-lg bg-accent-soft px-6 py-8 text-center">
        <p className="font-display text-lg">Заявка отправлена</p>
        <p className="mt-2 text-sm text-ink-muted">Свяжемся с вами в ближайшее время.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Имя" required error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>

        <Field label="Телефон" required error={errors.phone}>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+7 (900) 000-00-00"
          />
        </Field>
      </div>

      <Field label={messageLabel} error={errors[messageField]}>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={messagePlaceholder}
        />
      </Field>

      {/* Honeypot: человеку не виден, бот заполнит и получит отказ */}
      <div className="hidden" aria-hidden="true">
        <input
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <Checkbox
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        error={errors.consent_pd}
        label={
          <>
            Согласен на{" "}
            <a
              href="/consent"
              className="text-accent underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              обработку персональных данных
            </a>{" "}
            в соответствии с{" "}
            <a
              href="/privacy"
              className="text-accent underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              политикой конфиденциальности
            </a>
            <span className="text-accent"> *</span>
          </>
        }
      />

      {commonError ? (
        <p role="alert" className="rounded-sm bg-accent-soft px-3 py-2 text-xs text-danger">
          {commonError}
        </p>
      ) : null}

      <Button type="submit" disabled={status === "sending"} className="sm:px-8">
        {status === "sending" ? "Отправляем…" : submitLabel}
      </Button>
    </form>
  );
}
