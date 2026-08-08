import type { ReactNode } from "react";

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 px-1">
      <div className="min-w-0">
        <h2 className="text-xl md:text-2xl font-black tracking-tight truncate">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground truncate">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
