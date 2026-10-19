"use client";

/**
 * Герой главной по макету 1512.png: видео на всю ширину, заголовок Forum
 * в три строки, подзаголовок в две и кнопка «ОТКРЫТЬ ВИТРИНУ» справа внизу
 * (рядом с текстом — от 1280px, уже кнопка встаёт под текст). Шапка лежит
 * поверх (элемент `data-hero`).
 *
 * Высота — весь первый экран (100svh): бегущая строка начинается сразу под
 * героем и видна только после прокрутки (уточнение заказчика). На окне
 * 1512×982 это ровно макет. Минимум 640px — чтобы заголовок не налезал на шапку.
 *
 * Ниже 1280 — по кадрам главной 1194/834/390 (014): подзаголовок одним абзацем,
 * на 834 герой высотой 1000px и заголовок 55px, на телефоне кнопка во всю ширину.
 * Поля героя на этих ширинах — 40 и 32px, как у шапки в тех же кадрах.
 *
 * Фон — новый main.MP4 в трёх размерах: телефон, планшет и полный HD.
 * Ролик играет по кругу только в видимой вкладке и в пределах экрана;
 * при `prefers-reduced-motion` вместо него — постер из первого кадра.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LinkButton } from "@/components/ui";
import { imageUrl, type HeroBlock } from "@/lib/api";
import { typograf } from "@/lib/format";

const VIDEO_SRC = "/media/hero/hero-main.mp4";
const VIDEO_SRC_MOBILE = "/media/hero/hero-main-mobile.mp4";
const VIDEO_SRC_LIGHT = "/media/hero/hero-main-960.mp4";
const VIDEO_LIGHT_MEDIA = "(max-width: 1279px)";
const POSTER_SRC = "/media/hero/poster-main.webp";
const POSTER_SRC_MOBILE = "/media/hero/poster-main-mobile.webp";
// Браузер без H.264 остаётся на постере, не скачивая по очереди все MP4.
const VIDEO_TYPE = 'video/mp4; codecs="avc1"';

export function Hero({ content }: { content: HeroBlock }) {
  const videoSrc = imageUrl(content.video_key) ?? VIDEO_SRC;
  const customPoster = imageUrl(content.poster_key);
  const [playingSrc, setPlayingSrc] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  // Постер и шрифты важнее фонового ролика: видео не конкурирует с первым экраном.
  useEffect(() => {
    let cancelled = false;
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      void document.fonts.ready.then(() => {
        if (cancelled) return;
        if (typeof window.requestIdleCallback === "function") {
          idle = window.requestIdleCallback(() => setVideoReady(true), { timeout: 1500 });
        } else {
          timer = setTimeout(() => setVideoReady(true), 0);
        }
      });
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, []);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = () => {
      setReduceMotion(query.matches);
      if (query.matches) setPlayingSrc(null);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoReady) return;
    video.load();
    // React выставляет `muted` свойством, а не атрибутом, и в HTML с сервера его
    // может не быть — тогда браузер считает видео «со звуком» и блокирует
    // автозапуск. Выключаем звук явно и запускаем сами.
    video.muted = true;
    let inViewport = true;
    const syncPlayback = () => {
      if (document.visibilityState !== "visible" || !inViewport) {
        video.pause();
        return;
      }
      video.play().catch(() => {
        // Энергосбережение может запретить автозапуск — остаётся постер.
      });
    };
    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry?.isIntersecting ?? false;
      syncPlayback();
    });
    observer.observe(video);
    document.addEventListener("visibilitychange", syncPlayback);
    syncPlayback();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      video.pause();
    };
  }, [reduceMotion, videoSrc, videoReady]);

  return (
    <>
      {!customPoster ? (
        <>
          <link
            rel="preload"
            as="image"
            href={POSTER_SRC_MOBILE}
            media="(max-width: 639px)"
            fetchPriority="high"
          />
          <link
            rel="preload"
            as="image"
            href={POSTER_SRC}
            media="(min-width: 640px)"
            fetchPriority="high"
          />
        </>
      ) : null}
      <section
        data-hero
        className="relative isolate flex h-svh min-h-[640px] items-end overflow-hidden bg-night text-canvas sm:max-lg:h-[min(100svh,1000px)]"
      >
        {customPoster ? (
          <Image
            src={customPoster}
            alt=""
            fill
            priority
            sizes="(max-width: 1023px) 180vh, 100vw"
            className="-z-10 object-cover"
          />
        ) : (
          <picture className="absolute inset-0 -z-10">
            <source media="(max-width: 639px)" srcSet={POSTER_SRC_MOBILE} type="image/webp" />
            <img
              src={POSTER_SRC}
              alt=""
              width={1920}
              height={1080}
              fetchPriority="high"
              decoding="async"
              className="size-full object-cover"
            />
          </picture>
        )}
        {!reduceMotion ? (
          <video
            ref={videoRef}
            key={videoSrc}
            className={`absolute inset-0 -z-10 size-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${playingSrc === videoSrc ? "opacity-100" : "opacity-0"}`}
            onPlaying={() => setPlayingSrc(videoSrc)}
            onError={() => setPlayingSrc(null)}
            autoPlay={videoReady}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
          >
            {/* Браузер берёт первый подходящий source: узкий экран — лёгкий файл */}
            {videoReady && !content.video_key ? (
              <>
                <source
                  src={VIDEO_SRC_MOBILE}
                  media="(max-width: 639px) and (prefers-reduced-motion: no-preference)"
                  type={VIDEO_TYPE}
                />
                <source
                  src={VIDEO_SRC_LIGHT}
                  media={`${VIDEO_LIGHT_MEDIA} and (prefers-reduced-motion: no-preference)`}
                  type={VIDEO_TYPE}
                />
              </>
            ) : null}
            {videoReady ? (
              <source
                src={videoSrc}
                media="(prefers-reduced-motion: no-preference)"
                type={VIDEO_TYPE}
              />
            ) : null}
          </video>
        ) : null}

        <div className="container-page flex w-full flex-col gap-5 pt-40 pb-12 sm:max-lg:gap-[22px] sm:max-lg:px-8 sm:max-lg:pb-16 lg:max-xl:gap-[27px] lg:max-xl:px-10 lg:max-xl:pb-[72px] xl:flex-row xl:items-end xl:justify-between xl:gap-10 xl:pt-0 xl:pb-[49px]">
          <div className="xl:mb-[7px]">
            {/* Первый экран виден сразу; переходы между страницами анимирует PageTransitions. */}
            <h1 className="text-hero max-sm:text-[42px] sm:max-lg:text-[57px]">
              {content.title_lines.map((line) => (
                <span key={line} className="reveal-mask">
                  <span className="hero-line block">{typograf(line)}</span>
                </span>
              ))}
            </h1>
            <p className="hero-fade mt-1 max-w-[530px] sm:mt-3 lg:max-xl:-mt-px text-sm leading-7 font-light sm:max-w-[560px] sm:text-lg sm:leading-[30px] lg:text-[22px] lg:leading-[34px] xl:mt-[39px] xl:max-w-none xl:text-lead">
              {/* На 1280+ строки смысловые, как на макете 1512; уже — один абзац */}
              {content.subtitle_lines.map((line, index) => (
                <span key={line} className="xl:block">
                  {index > 0 ? " " : null}
                  {typograf(line)}
                </span>
              ))}
            </p>
          </div>
          <LinkButton
            href={content.cta.href}
            size="lg"
            className="hero-fade shrink-0 self-start max-sm:h-[60px] max-sm:w-full max-sm:self-stretch xl:self-auto"
          >
            {typograf(content.cta.label)}
          </LinkButton>
        </div>
      </section>
    </>
  );
}
