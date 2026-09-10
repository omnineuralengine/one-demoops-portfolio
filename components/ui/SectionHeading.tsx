import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function SectionHeading({
  icon: Icon,
  title,
  description,
  detail,
  eyebrow,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  detail?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <div className="section-heading__title">
          {Icon ? <Icon size={16} aria-hidden="true" /> : null}
          <h2>{title}</h2>
        </div>
        {description ?? detail ? <p>{description ?? detail}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
