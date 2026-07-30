import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  buildInvoiceWhatsappMessage,
  getOrCreatePortalToken,
  openWhatsappShare,
  portalUrl,
} from "@/lib/share";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoiceIds: string[];
  orgId: string;
  orgName?: string;
  currencyCode?: string;
  onSent?: (invoiceId: string) => void;
}

export function BulkReminderDialog({
  open, onOpenChange, invoiceIds, orgId, orgName, currencyCode = "INR", onSent,
}: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || invoiceIds.length === 0) return;
    setSent(new Set());
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, balance_due, due_date, last_reminder_at, reminder_count, clients(display_name, phone, email)")
        .in("id", invoiceIds)
        .neq("status", "paid")
        .neq("status", "void");
      setRows(data || []);
      setLoading(false);
    })();
  }, [open, invoiceIds]);

  const fmt = useMemo(
    () => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format,
    [currencyCode]
  );

  const handleSend = async (row: any) => {
    const client: any = row.clients;
    if (!client?.phone) {
      toast({ title: "No phone number", description: `${client?.display_name || "Client"} has no phone on file.`, variant: "destructive" });
      return;
    }
    const token = await getOrCreatePortalToken(orgId, "invoice", row.id);
    const overdueDays = row.due_date ? differenceInDays(new Date(), parseISO(row.due_date)) : 0;
    const baseMsg = buildInvoiceWhatsappMessage({
      orgName,
      clientName: client.display_name,
      invoiceNumber: row.invoice_number,
      amountFormatted: fmt(Number(row.balance_due || row.total)),
      dueDate: row.due_date,
      portalLink: token ? portalUrl(token) : null,
    });
    const reminderPrefix = overdueDays > 0
      ? `This is a friendly reminder — invoice is *${overdueDays} day(s) overdue*.\n\n`
      : `This is a friendly payment reminder.\n\n`;
    openWhatsappShare({ phone: client.phone, message: reminderPrefix + baseMsg });

    await supabase
      .from("invoices")
      .update({
        last_reminder_at: new Date().toISOString(),
        reminder_count: (row.reminder_count || 0) + 1,
      })
      .eq("id", row.id);

    setSent((s) => new Set(s).add(row.id));
    onSent?.(row.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Send Payment Reminders</DialogTitle>
          <DialogDescription>
            Send WhatsApp reminders one-by-one. Each click opens WhatsApp with a pre-filled message and the secure portal link.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No eligible invoices (paid/void are excluded).</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Reminder</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const client: any = r.clients;
                  const overdueDays = r.due_date ? differenceInDays(new Date(), parseISO(r.due_date)) : 0;
                  const hasPhone = !!client?.phone;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.invoice_number}</TableCell>
                      <TableCell className="text-sm">
                        {client?.display_name || "—"}
                        {!hasPhone && (
                          <div className="text-xs text-destructive flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3 w-3" /> No phone
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{fmt(Number(r.balance_due || r.total))}</TableCell>
                      <TableCell>
                        {overdueDays > 0 ? (
                          <Badge variant="destructive">Overdue {overdueDays}d</Badge>
                        ) : (
                          <Badge variant="secondary">Due</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.last_reminder_at ? `${format(parseISO(r.last_reminder_at), "dd MMM")} (${r.reminder_count || 0})` : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        {sent.has(r.id) ? (
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs inline-flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" /> Sent
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!hasPhone}
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                            onClick={() => handleSend(r)}
                          >
                            <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
