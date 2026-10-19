"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CakesPanel, CatalogPanel } from "./mega-panels";
import type { HeaderMenuData } from "./menu-data";

/** Монтируется при первом открытии и остаётся для плавного закрытия панели. */
export default function DesktopMenu({
  menuKey,
  open,
  menu,
  onClose,
}: {
  menuKey: "catalog" | "cakes";
  open: boolean;
  menu: HeaderMenuData;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <>
      <div className="absolute inset-x-0 top-full overflow-hidden">
        <AnimatePresence>
          {open ? (
            <motion.div
              key={menuKey}
              id={`mega-${menuKey}`}
              className="border-t border-line bg-canvas"
              initial={reduce ? { opacity: 0 } : { y: "-100%" }}
              animate={reduce ? { opacity: 1 } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: "-100%" }}
              transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            >
              {menuKey === "catalog" ? (
                <CatalogPanel categories={menu.categories} onNavigate={onClose} />
              ) : (
                <CakesPanel cakes={menu.cakes} onNavigate={onClose} />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
