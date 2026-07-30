import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type InvoiceStatus = "draft" | "sent" | "viewed" | "partial" | "paid" | "overdue" | "void";
type EstimateStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired" | "converted";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", className: "bg-primary/15 text-primary" },
  viewed: { label: "Viewed", className: "bg-purple-100 text-purple-700" },
  partial: { label: "Partially Paid", className: "bg-warning/15 text-warning" },
  paid: { label: "Paid", className: "bg-success/15 text-success" },
  overdue: { label: "Overdue", className: "bg-destructive/15 text-destructive animate-pulse-slow" },
  void: { label: "Void", className: "bg-muted text-muted-foreground line-through" },
  accepted: { label: "Accepted", className: "bg-success/15 text-success" },
  declined: { label: "Declined", className: "bg-destructive/15 text-destructive" },
  expired: { label: "Expired", className: "bg-warning/15 text-warning" },
  converted: { label: "Converted", className: "bg-success/15 text-success" },
};

export function StatusBadge({ status, children }: { status: string; children?: React.ReactNode }) {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <Badge variant="secondary" className={cn("font-medium", config.className)}>
      {children || config.label}
    </Badge>
  );
}
