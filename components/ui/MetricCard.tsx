import type { LucideIcon } from "lucide-react";
import { Panel } from "./Panel";

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "danger" | "amethyst";
}) {
  return (
    <Panel className="metric-card">
      <div className="metric-card__label">
        <span>{label}</span>
        {Icon ? <Icon size={15} aria-hidden="true" /> : null}
      </div>
      <strong className={`metric-card__value metric-card__value--${tone}`}>{value}</strong>
      {detail ? <span className="metric-card__detail">{detail}</span> : null}
    </Panel>
  );
}
