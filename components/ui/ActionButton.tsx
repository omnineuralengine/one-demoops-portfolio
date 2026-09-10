import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "default" | "primary" | "positive" | "danger" | "quiet";
  compact?: boolean;
};

export function ActionButton({
  children,
  tone = "default",
  compact = false,
  className = "",
  type = "button",
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={`action-button action-button--${tone}${compact ? " action-button--compact" : ""} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
