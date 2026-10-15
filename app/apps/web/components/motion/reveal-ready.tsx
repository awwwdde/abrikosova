"use client";

import { useEffect } from "react";

/**
 * Отметка «клиент запустился» для страховки из <head> (lib/reveal-boot.ts):
 * если за 3 с после DOMContentLoaded отметки нет, скрипт снимает `html.js`, и контент,
 * спрятанный под анимации появления, становится видимым без JS.
 */
export function RevealReady() {
  useEffect(() => {
    document.documentElement.dataset.reveal = "ready";
  }, []);
  return null;
}
