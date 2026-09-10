import type { HTMLAttributes, ReactNode } from "react";

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "section" | "div";
  children: ReactNode;
  elevated?: boolean;
};

export function Panel({ as: Element = "div", children, elevated = false, className = "", ...props }: PanelProps) {
  return (
    <Element className={`one-panel${elevated ? " one-panel--elevated" : ""} ${className}`.trim()} {...props}>
      {children}
    </Element>
  );
}
