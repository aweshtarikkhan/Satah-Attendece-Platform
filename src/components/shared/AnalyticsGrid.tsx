import { ReactNode } from "react";

interface AnalyticsCard {
  title: string;
  subtitle?: ReactNode;
  body: ReactNode;
}

interface AnalyticsGridProps {
  label?: string;
  cards: AnalyticsCard[];
}

export function AnalyticsGrid({ label = "Financial Dashboard Analysis", cards }: AnalyticsGridProps) {
  if (!cards.length) return null;
  return (
    <section className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div
            key={i}
            className="rounded-2xl bg-card border border-border/60 shadow-sm p-4 flex flex-col transition-all hover:shadow-md"
          >
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
              {c.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{c.subtitle}</div>}
            </div>
            <div className="flex-1 min-h-[180px]">{c.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
