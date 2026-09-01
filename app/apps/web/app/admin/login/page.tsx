"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { Button, Field, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/admin");
    } catch (err) {
      // Текст ошибки приходит с сервера и не различает «нет такого e-mail»
      // и «неверный пароль» — иначе форма перечисляла бы существующие аккаунты
      setError(err instanceof ApiError ? err.message : "Не удалось войти");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-xl bg-surface p-8 shadow-raised"
        noValidate
      >
        <div className="mb-2">
          <p className="eyebrow mb-2">Абрикосова</p>
          <h1 className="text-2xl">Вход в админ-панель</h1>
        </div>

        <Field label="E-mail" required>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </Field>

        <Field label="Пароль" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>

        {error ? (
          <p role="alert" className="rounded-sm bg-accent-soft px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Входим…" : "Войти"}
        </Button>
      </form>
    </div>
  );
}
