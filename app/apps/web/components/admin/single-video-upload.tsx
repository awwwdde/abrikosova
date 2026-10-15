"use client";

import { useId, useRef, useState } from "react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { Button } from "@/components/admin/ui";
import { ApiError, imageUrl } from "@/lib/api";
import type { components } from "@/lib/api-schema";

export function SingleVideoUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (video: string | null, poster: string | null) => void;
}) {
  const { upload } = useAdminAuth();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const src = imageUrl(value);
  async function send(file: File) {
    setError(null);
    if (file.size > 100 * 1024 * 1024) {
      setError("Видео больше 100 МБ");
      return;
    }
    setProgress(0);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await upload<components["schemas"]["VideoUploadOut"]>(
        "/admin/uploads/video",
        body,
        setProgress,
      );
      onChange(result.storage_key, result.poster_key);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Не удалось загрузить видео. Попробуйте ещё раз",
      );
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="text-[13.5px] font-bold">
        Видео первого экрана
      </label>
      {src ? (
        <video
          src={src}
          controls
          muted
          playsInline
          preload="metadata"
          className="aspect-video w-full max-w-[480px] rounded-admin-control bg-admin-photo"
        />
      ) : (
        <p className="text-sm text-admin-muted">Используется стандартное видео</p>
      )}
      <p className="text-[12.5px] text-admin-muted">
        MP4, MOV или WebM, до 100 МБ и трёх минут. Подготовим MP4 без звука и постер. На сайте видео
        играет по кругу.
      </p>
      <input
        ref={input}
        id={id}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mov"
        className="sr-only"
        disabled={progress !== null}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void send(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={progress !== null}
          onClick={() => input.current?.click()}
        >
          {src ? "Заменить видео" : "Загрузить видео"}
        </Button>
        {value ? (
          <Button
            variant="outline"
            disabled={progress !== null}
            onClick={() => onChange(null, null)}
          >
            Вернуть стандартное видео
          </Button>
        ) : null}
      </div>
      {progress !== null ? (
        <p role="status" className="text-sm text-admin-muted">
          {progress < 1
            ? `Загружаем видео: ${Math.round(progress * 100)}%`
            : "Готовим видео и постер…"}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-admin-side">
          {error}
        </p>
      ) : null}
      <p className="text-[12.5px] text-admin-muted">
        После загрузки нажмите «Сохранить», чтобы заменить видео на сайте.
      </p>
    </div>
  );
}
