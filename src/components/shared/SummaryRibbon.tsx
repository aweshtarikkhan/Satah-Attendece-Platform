import { ReactNode } from "react";

interface SummaryItem {
  label: string;
  value: ReactNode;
  accent?: "default" | "success" | "warning" | "danger" | "info";
  hint?: string;
}

interface SummaryRibbonProps {
  label: string;
  items: SummaryItem[];
}

const accentClass: Record<NonNullable<SummaryItem["accent"]>, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-orange-600 dark:text-orange-400",
  danger: "text-rose-600 dark:text-rose-400",
  info: "text-blue-600 dark:text-blue-400",
};

export function SummaryRibbon({ label, items }: SummaryRibbonProps) {
  const cols =
    items.length <= 2 ? "sm:grid-cols-2" :
    items.length === 3 ? "sm:grid-cols-3" :
    items.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" :
    "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
  return (
    <section className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className={`grid grid-cols-1 ${cols} gap-4`}>
        {items.map((it, i) => (
          <div
            key={i}
            className="rounded-2xl bg-card border border-border/60 shadow-sm px-6 py-5 transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <p className="text-sm font-medium text-muted-foreground mb-2">{it.label}</p>
            <p className={`text-2xl md:text-[28px] font-bold leading-tight ${accentClass[it.accent || "default"]}`}>
              {it.value}
            </p>
            {it.hint && <p className="text-xs text-muted-foreground mt-1">{it.hint}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
