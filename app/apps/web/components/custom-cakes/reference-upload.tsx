"use client";

/**
 * Свой образец в окне заявки (008c, кадры «окно со своим образцом» и «Состояния»):
 * пунктирная зона «Перетащите фото-образец или выберите файл», до 5 фото.
 *
 * Перетаскивание и выбор файла; превью с удалением (HEIC браузер не показывает —
 * у такого превью имя файла на плашке), счётчик «3 из 5». Тип и размер проверяются
 * и здесь — чтобы человек узнал сразу, а не после отправки; истина — на сервере
 * (тип по содержимому, EXIF снимается). Файлы живут в состоянии окна: при сетевой
 * ошибке отправки они остаются.
 */

import { X } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { fileError, MAX_REFERENCES } from "@/lib/consultation-form";

export function ReferenceUpload({
  files,
  onChange,
  error,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  /** Ошибка сервера про файлы (400/413) */
  error?: string | null;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const previews = useMemo(
    () =>
      files.map((file) =>
        /^image\/(jpeg|png|webp)$/.test(file.type) ? URL.createObjectURL(file) : null,
      ),
    [files],
  );
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews]);

  function add(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    const found: string[] = [];
    for (const file of Array.from(list)) {
      const problem = fileError(file);
      if (problem) found.push(problem);
      else if (next.length >= MAX_REFERENCES)
        found.push(`Не больше ${MAX_REFERENCES} фото — «${file.name}» не добавлен`);
      else next.push(file);
    }
    setProblems(found);
    onChange(next);
    if (input.current) input.current.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    add(event.dataTransfer.files);
  }

  const messages = [...problems, ...(error ? [error] : [])];
  const full = files.length >= MAX_REFERENCES;

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-[84px] flex-col items-center justify-center border border-dashed px-4 py-[17px] text-center transition-colors duration-150 ${
          dragging ? "border-ink bg-photo" : messages.length ? "border-accent" : "border-ink-subtle"
        }`}
      >
        <p className="text-[15px] leading-5 text-ink">
          {full ? (
            "Добавлено 5 фото — больше нельзя"
          ) : (
            <>
              Перетащите фото-образец или{" "}
              <label
                htmlFor={inputId}
                className="cursor-pointer font-semibold underline underline-offset-2 hover:text-accent"
              >
                выберите файл
              </label>
            </>
          )}
        </p>
        <p id={hintId} className="mt-[7px] text-[13px] leading-4 text-ink-subtle">
          {files.length
            ? `${files.length} из ${MAX_REFERENCES}`
            : "До 5 фото, можно скриншоты из соцсетей"}
        </p>
        <input
          ref={input}
          id={inputId}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          disabled={full}
          aria-describedby={messages.length ? `${hintId} ${errorId}` : hintId}
          onChange={(event) => add(event.target.files)}
          className="sr-only"
        />
      </div>

      {messages.length ? (
        <ul id={errorId} className="mt-[7px] text-[13px] leading-5 text-accent">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      {files.length ? (
        <ul aria-label="Фото-образцы" className="mt-3 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="relative size-[72px] bg-photo">
              {previews[index] ? (
                // blob: из выбранного файла — next/image его не оптимизирует, и не нужно
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[index]!} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center px-1 text-center text-[10px] leading-tight break-all text-ink-subtle">
                  {file.name}
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label={`Убрать фото «${file.name}»`}
                className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-ink text-canvas"
              >
                <X aria-hidden="true" size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
