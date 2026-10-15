"use client";

/**
 * Одиночная загрузка фото для разделов, где фото — поле самой записи: работы,
 * начинки, торты на заказ (011f, кит админки). Загрузка с прогрессом, под фото —
 * «Фото маленькое…», если длинная сторона меньше 1200 px (как у фото товара в 011d;
 * хранилище большие фото уменьшает, маленькие не увеличивает).
 */

import { ImageSquare, UploadSimple, Warning, X } from "@phosphor-icons/react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { Button } from "@/components/admin/ui";
import { ApiError, imageUrl } from "@/lib/api";
import { isSmallPhoto } from "@/lib/product-form";

const ACCEPT = "image/jpeg,image/png,image/webp";

export function SingleImageUpload({
  prefix,
  value,
  onChange,
  label = "Фото",
  hint,
  optional = false,
  ratio = "4/5",
}: {
  prefix: "gallery" | "fillings" | "custom-cakes" | "reviews" | "pages";
  value: string | null;
  onChange: (key: string | null) => void;
  label?: string;
  hint?: string;
  /** Можно убрать фото (второй кадр работы) */
  optional?: boolean;
  ratio?: "4/5" | "1/1";
}) {
  const { upload } = useAdminAuth();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [share, setShare] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [small, setSmall] = useState(false);
  const src = imageUrl(value);

  useEffect(() => {
    setSmall(false);
    if (!src) return;
    let cancelled = false;
    const probe = new window.Image();
    probe.onload = () => {
      if (!cancelled) setSmall(isSmallPhoto(probe.naturalWidth, probe.naturalHeight));
    };
    probe.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  async function send(file: File) {
    setShare(0);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await upload<{ storage_key: string }>(
        `/admin/uploads?prefix=${prefix}`,
        form,
        setShare,
      );
      onChange(result.storage_key);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить файл");
    } finally {
      setShare(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13.5px] font-bold">{label}</span>
      <div className="flex items-start gap-3">
        <span
          className={`flex w-24 shrink-0 items-center justify-center overflow-hidden rounded-admin-control bg-admin-photo text-admin-faint ${
            ratio === "1/1" ? "aspect-square" : "aspect-[4/5]"
          }`}
        >
          {src ? (
            <Image
              src={src}
              alt=""
              width={96}
              height={120}
              sizes="96px"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageSquare aria-hidden="true" size={24} />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <label
              htmlFor={inputId}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-admin-small border border-admin-disabled bg-admin-card px-3 text-[12.5px] font-bold text-admin-ink hover:border-admin-side hover:bg-admin-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-admin-side"
            >
              <UploadSimple aria-hidden="true" size={15} />
              {value ? "Заменить" : "Загрузить"}
              <span className="sr-only">: {label}</span>
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                disabled={share !== null}
                onChange={(event) => event.target.files?.[0] && void send(event.target.files[0])}
              />
            </label>
            {optional && value ? (
              <Button
                variant="ghost"
                size="sm"
                icon={<X aria-hidden="true" size={14} />}
                onClick={() => onChange(null)}
              >
                Убрать
              </Button>
            ) : null}
          </div>
          {share !== null ? (
            <progress
              value={Math.round(share * 100)}
              max={100}
              aria-label={`Загрузка: ${label}`}
              className="h-1.5 w-40 overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-admin-line [&::-webkit-progress-value]:bg-admin-side"
            />
          ) : null}
          {hint ? <span className="text-[12.5px] text-admin-muted">{hint}</span> : null}
          {small ? (
            <span className="flex items-start gap-1 text-[12px] font-semibold text-admin-amber">
              <Warning aria-hidden="true" size={14} className="mt-px shrink-0" />
              Фото маленькое, на сайте может выглядеть размытым
            </span>
          ) : null}
          {error ? (
            <span role="alert" className="text-[12.5px] font-semibold text-admin-side">
              {error}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
