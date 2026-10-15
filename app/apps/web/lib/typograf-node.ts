import { Children, type ReactNode } from "react";
import { typograf } from "./format";

/**
 * `typograf` для содержимого React: строки среди прямых детей проходят через
 * типографику, элементы остаются как есть. Для обёрток вроде `Reveal`, которые
 * получают текст через children.
 */
export function typografNode(children: ReactNode): ReactNode {
  return Children.map(children, (child) => (typeof child === "string" ? typograf(child) : child));
}
