"use client";

/**
 * Вход в админку по утверждённому концепту new/design/admin/Main.dc.html (задание 011a).
 *
 * Бордовая рамка, внутри две скруглённые панели: слева кремовая с формой, справа
 * фото (components/admin/login-photos.tsx). Уже 1024px — одна колонка, фото
 * полосой 28vh сверху внутри той же рамки.
 *
 * Поведение:
 * - автозаполнение: username / current-password, e-mail без автокоррекции, фокус на e-mail;
 * - «показать пароль» и метка «Включён Caps Lock»;
 * - ошибка с сервера — под формой (role="alert");
 * - блокировка (429) — живой отсчёт, кнопка неактивна до конца;
 * - во время отправки поля и кнопка заблокированы, повторной отправки нет;
 * - после входа — туда, откуда выкинуло (`next`, только пути внутри /admin).
 *
 * Форма — method="post" без action: если JS не загрузился, данные уйдут POST-ом
 * на эту же страницу, а не GET-ом в адресную строку вместе с паролем.
 */

import { CaretLeft, EnvelopeSimple, Eye, EyeSlash, LockSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { LoginPhotos } from "@/components/admin/login-photos";
import { Logo } from "@/components/logo";
import { Button, Field, Input, Notice, Pill } from "@/components/admin/ui";
import { ApiError } from "@/lib/api";
import { formatCountdown, safeNextPath } from "@/lib/admin-login";

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Живой отсчёт блокировки; по окончании форма снова доступна
  useEffect(() => {
    if (lockedUntil === null) return;
    const tick = () => {
      const left = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (left <= 0) {
        setLockedUntil(null);
        setSecondsLeft(0);
      } else {
        setSecondsLeft(left);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const locked = lockedUntil !== null;

  function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || locked) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace(safeNextPath(new URLSearchParams(window.location.search).get("next")));
    } catch (err) {
      setPassword("");
      if (err instanceof ApiError && err.status === 429) {
        const seconds = Number(err.data?.retry_after) || 60;
        setLockedUntil(Date.now() + seconds * 1000);
      } else if (err instanceof ApiError) {
        // Текст с сервера не различает «нет такого e-mail» и «неверный пароль» —
        // иначе форма перечисляла бы существующие аккаунты
        setError(err.status === 422 ? "Проверьте e-mail и пароль" : err.message);
      } else {
        setError("Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз");
      }
      setSubmitting(false);
    }
  }

  return (
    // main — у страницы входа нет каркаса админки с его <main> (axe: landmark-one-main, 011g)
    <main className="grid min-h-dvh gap-3 bg-admin-side p-3 font-sans text-ink adm-lg:grid-cols-[minmax(480px,44%)_minmax(0,1fr)]">
      <div className="flex flex-col justify-between gap-10 rounded-[28px] bg-admin-panel px-6 pt-7 pb-7 adm-sm:px-14 adm-sm:pt-9 adm-sm:pb-8">
        <Link
          href="/"
          aria-label="Кондитерская Елены Абрикосовой, открыть сайт"
          className="self-start text-ink"
        >
          <Logo className="w-[130px]" />
        </Link>

        <form
          method="post"
          onSubmit={handleSubmit}
          className="flex w-full max-w-[400px] flex-col gap-[18px] self-center"
        >
          <div className="mb-2.5 flex flex-col gap-2">
            <h1 className="font-display text-[40px] leading-[1.05] adm-sm:text-[52px]">
              С возвращением
            </h1>
            <p className="text-[15.5px] text-admin-muted">Войдите в админ-панель кондитерской</p>
          </div>

          <fieldset disabled={submitting} className="flex flex-col gap-[18px]">
            <Field label="E-mail">
              {(a11y) => (
                <Input
                  {...a11y}
                  name="email"
                  type="email"
                  size="lg"
                  icon={<EnvelopeSimple size={20} />}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={trackCapsLock}
                  onKeyUp={trackCapsLock}
                  autoComplete="username"
                  inputMode="email"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoFocus
                  required
                />
              )}
            </Field>

            <Field label="Пароль" hint={capsLock ? <Pill>Включён Caps Lock</Pill> : null}>
              {(a11y) => (
                <Input
                  {...a11y}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  size="lg"
                  icon={<LockSimple size={20} />}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={trackCapsLock}
                  onKeyUp={trackCapsLock}
                  autoComplete="current-password"
                  required
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPassword((shown) => !shown)}
                      aria-pressed={showPassword}
                      aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                      className="inline-flex size-[42px] items-center justify-center rounded-admin-small text-admin-muted transition-colors duration-150 hover:bg-admin-soft hover:text-admin-side focus-visible:outline-2 focus-visible:outline-admin-side"
                    >
                      {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                    </button>
                  }
                />
              )}
            </Field>
          </fieldset>

          {locked ? (
            <Notice role="alert" icon={<LockSimple size={20} />}>
              Слишком много попыток. Вход откроется через{" "}
              <b className="tnum">{formatCountdown(secondsLeft)}</b>
            </Notice>
          ) : error ? (
            <Notice role="alert">{error}</Notice>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={locked}
            loading={submitting}
            className="mt-1.5 w-full"
          >
            {locked ? "Вход временно закрыт" : submitting ? "Входим…" : "Войти"}
          </Button>

          <p className="text-center text-[13.5px] leading-normal text-admin-muted">
            Забыли пароль? Попросите владельца сайта задать новый.
          </p>
        </form>

        <Link
          href="/"
          className="inline-flex items-center gap-2 self-start text-[13.5px] font-bold text-admin-muted transition-colors duration-150 hover:text-admin-side"
        >
          <CaretLeft size={17} aria-hidden="true" />
          Вернуться на сайт
        </Link>
      </div>

      <LoginPhotos className="order-first h-[28vh] adm-lg:order-none adm-lg:h-auto adm-lg:min-h-[calc(100dvh-24px)]" />
    </main>
  );
}
