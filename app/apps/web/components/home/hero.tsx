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

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { preload } from "react-dom";
import { LinkButton } from "@/components/ui";
import { imageUrl, type HeroBlock } from "@/lib/api";
import { typograf } from "@/lib/format";

const VIDEO_SRC = "/media/hero/hero-main.mp4";
const VIDEO_SRC_MOBILE = "/media/hero/hero-main-mobile.mp4";
const VIDEO_SRC_LIGHT = "/media/hero/hero-main-960.mp4";
const VIDEO_LIGHT_MEDIA = "(max-width: 1279px)";
const POSTER_SRC = "/media/hero/poster-main.jpg";
// Браузер без H.264 остаётся на постере, не скачивая по очереди все MP4.
const VIDEO_TYPE = 'video/mp4; codecs="avc1"';

export function Hero({ content }: { content: HeroBlock }) {
  const videoSrc = imageUrl(content.video_key) ?? VIDEO_SRC;
  const posterSrc = imageUrl(content.poster_key) ?? POSTER_SRC;
  // Постер — первое, что видно на мобильном до загрузки видео, и это LCP:
  // грузим его с высоким приоритетом ещё до разбора <video>
  preload(posterSrc, { as: "image", fetchPriority: "high" });
  const [reduceMotion, setReduceMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = () => setReduceMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
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
  }, [reduceMotion, videoSrc]);

  return (
    <section
      data-hero
      data-hero-anim=""
      className="relative isolate flex h-svh min-h-[640px] items-end overflow-hidden bg-night text-canvas sm:max-lg:h-[min(100svh,1000px)]"
    >
      {reduceMotion ? (
        // eslint-disable-next-line @next/next/no-img-element -- фоновый постер, next/image здесь лишний JS
        <img
          src={posterSrc}
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover"
          fetchPriority="high"
        />
      ) : (
        <video
          ref={videoRef}
          key={videoSrc}
          className="absolute inset-0 -z-10 size-full object-cover"
          poster={posterSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          {/* Браузер берёт первый подходящий source: узкий экран — лёгкий файл */}
          {!content.video_key ? (
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
          <source
            src={videoSrc}
            media="(prefers-reduced-motion: no-preference)"
            type={VIDEO_TYPE}
          />
        </video>
      )}

      <div className="container-page flex w-full flex-col gap-5 pt-40 pb-12 sm:max-lg:gap-[22px] sm:max-lg:px-8 sm:max-lg:pb-16 lg:max-xl:gap-[27px] lg:max-xl:px-10 lg:max-xl:pb-[72px] xl:flex-row xl:items-end xl:justify-between xl:gap-10 xl:pt-0 xl:pb-[49px]">
        <div className="xl:mb-[7px]">
          {/* Короткое появление запускается CSS при первой отрисовке, без ожидания
              гидрации. Текст остаётся видимым, поэтому LCP не ждёт анимацию.
              Строки заголовка смысловые и заданы в контенте — разбивать их не нужно;
              на телефоне строка может занять две, маска двигает её целиком. */}
          <h1 className="text-hero max-sm:text-[42px] sm:max-lg:text-[57px]">
            {content.title_lines.map((line, index) => (
              <span key={line} className="reveal-mask">
                <span className="hero-line block" style={{ "--i": index } as CSSProperties}>
                  {typograf(line)}
                </span>
              </span>
            ))}
          </h1>
          <p
            className="hero-fade mt-1 max-w-[530px] sm:mt-3 lg:max-xl:-mt-px text-sm leading-7 font-light sm:max-w-[560px] sm:text-lg sm:leading-[30px] lg:text-[22px] lg:leading-[34px] xl:mt-[39px] xl:max-w-none xl:text-lead"
            style={{ "--delay": "0.08s" } as CSSProperties}
          >
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
          style={{ "--delay": "0.12s" } as CSSProperties}
        >
          {typograf(content.cta.label)}
        </LinkButton>
      </div>
    </section>
  );
}
