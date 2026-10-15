"use client";

/**
 * Фото на странице входа (задание 011a): работы из «Примеров работ» и главные фото
 * товаров, смена раз в 10 минут. Только фотография — без подписей и точек поверх
 * (утверждённый концепт); название работы или товара — в alt.
 *
 * Какое фото показывать, решает номер 10-минутного слота в списке, перемешанном по
 * сиду дня (lib/admin-login.ts): все открытые вкладки показывают одно фото, при
 * перезагрузке оно не прыгает. Таймер ставится ровно до границы слота, а не
 * setInterval на 10 минут: интервал дрейфует, а фоновые вкладки браузер
 * притормаживает. При возврате на вкладку фото пересчитывается сразу.
 *
 * Смена — кроссфейд 1,2 с. В DOM лежат три слоя: уходящее, текущее и следующее;
 * следующее уже загружено (невидимым), поэтому смена не ждёт сети. При
 * prefers-reduced-motion — без перехода. Нет фото или ошибка API — однотонная
 * панель с логотипом, форма работает как обычно.
 *
 * Фото показывается целиком и не крупнее натурального размера (дополнение 2 к 011a):
 * демо-снимки 336×420, растянутые `object-cover` на панель ~830×950, выглядели
 * размытыми. Торты сняты на однотонном фоне, поэтому кадрировать незачем — фото
 * стоит по центру (ширина не больше 72 % панели, высота не больше 80 %), а панель
 * красится в цвет фона снимка (`bg` из API), и края фотографии не читаются как
 * прямоугольник. Фон меняется тем же переходом 1,2 с, что и фото.
 */

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/logo";
import { apiFetch, imageUrl, type LoginPhoto } from "@/lib/api";
import { msUntilNextSlot, photoIndexAt, shuffleForDay } from "@/lib/admin-login";

export function LoginPhotos({ className = "" }: { className?: string }) {
  const [photos, setPhotos] = useState<LoginPhoto[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    apiFetch<LoginPhoto[]>("/content/login-photos")
      .then((items) => !cancelled && setPhotos(items.filter((item) => imageUrl(item.image_key))))
      .catch(() => !cancelled && setPhotos([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // Смена точно на границе слота; при возврате на вкладку — сразу актуальное фото
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), msUntilNextSlot(Date.now()) + 50);
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [now]);

  const ordered = useMemo(() => (photos ? shuffleForDay(photos, now) : []), [photos, now]);
  const index = photoIndexAt(ordered.length, now);

  // Уходящее, текущее и следующее; при одном-двух фото — без повторов
  const layers = useMemo(() => {
    if (index < 0) return [];
    const count = ordered.length;
    const picks = [(index - 1 + count) % count, index, (index + 1) % count];
    const seen = new Set<string>();
    return picks.flatMap((i) => {
      const photo = ordered[i];
      if (!photo || seen.has(photo.image_key)) return [];
      seen.add(photo.image_key);
      return [{ photo, current: i === index }];
    });
  }, [ordered, index]);

  const background = layers.find((layer) => layer.current)?.photo.bg;

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] bg-admin-photo transition-[background-color] duration-[1200ms] ease-out-soft motion-reduce:transition-none ${className}`}
      style={background ? { backgroundColor: background } : undefined}
    >
      {layers.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-admin-side/25">
          <Logo className="w-40" />
        </div>
      ) : (
        layers.map(({ photo, current }) => (
          <div
            key={photo.image_key}
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-[1200ms] ease-out-soft motion-reduce:transition-none ${
              current ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={current ? undefined : true}
          >
            <Image
              src={imageUrl(photo.image_key) ?? ""}
              alt={current ? photo.caption : ""}
              width={photo.width}
              height={photo.height}
              // Первое фото — сразу с высоким приоритетом, это самая большая картинка экрана
              priority={current}
              quality={90}
              // Реальная ширина показа: не больше натуральной и 72 % панели
              // (панель ≈ 56 % окна на десктопе и всё окно на мобильном)
              sizes={`(min-width: 1024px) min(${photo.width}px, 40vw), min(${photo.width}px, 72vw)`}
              // Не крупнее натурального размера; если упирается в 80 % высоты —
              // object-contain уменьшает фото, сохраняя пропорции
              style={{
                width: `min(${photo.width}px, 72%)`,
                height: "auto",
                maxHeight: "80%",
                aspectRatio: `${photo.width} / ${photo.height}`,
              }}
              className="object-contain"
            />
          </div>
        ))
      )}
    </div>
  );
}
