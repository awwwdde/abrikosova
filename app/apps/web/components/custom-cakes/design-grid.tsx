"use client";

import { useId, useState, type ReactNode } from "react";
import { RevealGroup } from "@/components/motion";
import { Button } from "@/components/ui";

/** На телефоне длинный каталог раскрывается порциями; без JS доступны все дизайны. */
export function DesignGrid({ children, count }: { children: ReactNode; count: number }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? count : Math.min(8, count);
  function expand() {
    setExpanded(true);
    requestAnimationFrame(() => {
      const firstNew = document.getElementById(id)?.children[9] as HTMLElement | undefined;
      firstNew?.setAttribute("tabindex", "-1");
      firstNew?.focus({ preventScroll: true });
    });
  }
  return (
    <>
      <RevealGroup
        as="ul"
        id={id}
        data-design-grid
        data-expanded={expanded}
        className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-y-[55px]"
      >
        {children}
      </RevealGroup>
      {count > 8 ? (
        <div className="mt-6 hidden [.js_&]:block sm:!hidden">
          <p className="text-center text-xs leading-5 text-ink-muted" aria-live="polite">
            Показано {shown} из {count}
          </p>
          <div className="mx-auto mt-3 h-0.5 w-40 bg-line" aria-hidden="true">
            <div className="h-full bg-accent" style={{ width: `${(shown / count) * 100}%` }} />
          </div>
          {!expanded ? (
            <Button
              variant="outline"
              size="md"
              className="mt-3 h-[52px] w-full"
              aria-controls={id}
              aria-expanded={false}
              onClick={expand}
            >
              Показать ещё {count - shown}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
