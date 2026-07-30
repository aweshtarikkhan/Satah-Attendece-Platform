import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-words">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground break-words">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {children}
        </div>
      )}
    </div>
  );
}
