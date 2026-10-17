"use client";

import { useEffect, useState, type ComponentPropsWithoutRef } from "react";

/** Покупка остаётся под рукой, но не перекрывает ссылки и реквизиты футера. */
export function FloatingActionBar({ style, ...props }: ComponentPropsWithoutRef<"div">) {
  const [footerVisible, setFooterVisible] = useState(false);
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry?.isIntersecting ?? false),
      { rootMargin: "0px 0px 80px 0px" },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      {...props}
      data-floating-action-bar
      style={{ ...style, display: footerVisible ? "none" : style?.display }}
    />
  );
}
