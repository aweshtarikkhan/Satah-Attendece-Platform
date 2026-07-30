import { ReactNode } from "react";

interface PageActionBarProps {
  title: string;
  children?: ReactNode;
}

export function PageActionBar({ title, children }: PageActionBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
