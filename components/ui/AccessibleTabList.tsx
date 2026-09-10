"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface AccessibleTab<T extends string> {
  id: T;
  label: string;
  contentId: string;
}

export function AccessibleTabList<T extends string>({
  tabs,
  selected,
  onSelect,
  ariaLabel,
  className,
  idPrefix,
  renderLabel,
}: {
  tabs: readonly AccessibleTab<T>[];
  selected: T;
  onSelect: (id: T) => void;
  ariaLabel: string;
  className?: string;
  idPrefix: string;
  renderLabel?: (tab: AccessibleTab<T>, index: number) => ReactNode;
}) {
  const buttons = useRef(new Map<T, HTMLButtonElement>());

  function selectAndFocus(index: number) {
    const next = tabs[index];
    if (!next) return;
    onSelect(next.id);
    buttons.current.get(next.id)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: T) {
    const current = tabs.findIndex((tab) => tab.id === id);
    let next: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (current + 1) % tabs.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (current - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = tabs.length - 1;
    }

    if (next === null) return;
    event.preventDefault();
    selectAndFocus(next);
  }

  return (
    <div className={className} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(node) => {
            if (node) buttons.current.set(tab.id, node);
            else buttons.current.delete(tab.id);
          }}
          id={`${idPrefix}-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={selected === tab.id}
          aria-controls={tab.contentId}
          tabIndex={selected === tab.id ? 0 : -1}
          onClick={() => onSelect(tab.id)}
          onKeyDown={(event) => handleKeyDown(event, tab.id)}
        >
          {renderLabel ? renderLabel(tab, index) : tab.label}
        </button>
      ))}
    </div>
  );
}
