"use client";

/**
 * Полные хлебные крошки (011e): раздел меню знает шапка, а «Торты › Медовик» —
 * только сама страница, когда загрузит товар. Страница передаёт хвост сюда
 * (`useBreadcrumbTrail`), шапка дорисовывает его после раздела.
 */

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Crumb = { label: string; href?: string };

type TrailValue = { trail: Crumb[]; setTrail: (trail: Crumb[]) => void };

const TrailContext = createContext<TrailValue>({ trail: [], setTrail: () => {} });

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<Crumb[]>([]);
  return <TrailContext.Provider value={{ trail, setTrail }}>{children}</TrailContext.Provider>;
}

export function useBreadcrumbTrail(trail: Crumb[]) {
  const { setTrail } = useContext(TrailContext);
  const key = JSON.stringify(trail);
  useEffect(() => {
    setTrail(JSON.parse(key) as Crumb[]);
    return () => setTrail([]);
  }, [key, setTrail]);
}

export function useTrail(): Crumb[] {
  return useContext(TrailContext).trail;
}
