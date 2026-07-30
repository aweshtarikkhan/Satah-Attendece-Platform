import { supabase } from "@/integrations/supabase/client";
import { addDays, addMonths, addYears, format } from "date-fns";

export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

export function advanceDate(from: string, frequency: Frequency): string {
  const d = new Date(from);
  let next = d;
  switch (frequency) {
    case "weekly": next = addDays(d, 7); break;
    case "monthly": next = addMonths(d, 1); break;
    case "quarterly": next = addMonths(d, 3); break;
    case "yearly": next = addYears(d, 1); break;
  }
  return format(next, "yyyy-MM-dd");
}

/** Generate a new invoice from a recurring schedule. Returns the new invoice id. */
export async function generateRecurringInvoice(scheduleId: string): Promise<string> {
  const { data: schedule, error: sErr } = await supabase
    .from("recurring_invoices")
    .select("*")
    .eq("id", scheduleId)
    .single();
  if (sErr || !schedule) throw new Error(sErr?.message || "Schedule not found");
  if (!schedule.template_invoice_id) {
    throw new Error("This schedule has no template invoice. Edit the schedule and pick one.");
  }

  // Fetch template invoice + lines + org for numbering
  const [{ data: tmpl }, { data: tmplLines }, { data: org }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", schedule.template_invoice_id).single(),
    supabase.from("invoice_lines").select("*").eq("invoice_id", schedule.template_invoice_id).order("sort_order"),
    supabase.from("organizations").select("invoice_next_number, invoice_prefix").eq("id", schedule.org_id).single(),
  ]);
  if (!tmpl) throw new Error("Template invoice not found");

  const prefix = org?.invoice_prefix || "INV";
  const num = org?.invoice_next_number || 1;
  const year = new Date().getFullYear();
  const invoiceNumber = `${prefix}-${year}-${String(num).padStart(4, "0")}`;

  const issueDate = format(new Date(), "yyyy-MM-dd");
  const paymentTermsDays = Math.max(
    0,
    Math.round(
      (new Date(tmpl.due_date).getTime() - new Date(tmpl.issue_date).getTime()) / (1000 * 60 * 60 * 24)
    ) || 30
  );
  const dueDate = format(addDays(new Date(issueDate), paymentTermsDays), "yyyy-MM-dd");

  const payload = {
    org_id: schedule.org_id,
    client_id: schedule.client_id,
    invoice_number: invoiceNumber,
    status: "draft" as const,
    issue_date: issueDate,
    due_date: dueDate,
    currency_code: tmpl.currency_code,
    discount: tmpl.discount,
    discount_type: tmpl.discount_type,
    shipping_charge: tmpl.shipping_charge,
    expenses: (tmpl as any).expenses || 0,
    adjustment: tmpl.adjustment,
    adjustment_name: tmpl.adjustment_name,
    subtotal: tmpl.subtotal,
    total_tax: tmpl.total_tax,
    total_discount: tmpl.total_discount,
    total: tmpl.total,
    balance_due: tmpl.total,
    notes: tmpl.notes,
    terms_conditions: tmpl.terms_conditions,
    deduct_stock: false,
  };

  const { data: newInv, error: iErr } = await supabase
    .from("invoices")
    .insert(payload)
    .select()
    .single();
  if (iErr || !newInv) throw new Error(iErr?.message || "Failed to create invoice");

  if (tmplLines && tmplLines.length) {
    const lines = tmplLines.map((l, i) => ({
      invoice_id: newInv.id,
      item_id: l.item_id,
      name: l.name,
      description: l.description,
      unit: l.unit,
      quantity: l.quantity,
      rate: l.rate,
      discount: l.discount,
      discount_type: l.discount_type,
      tax_id: l.tax_id,
      tax_amount: l.tax_amount,
      amount: l.amount,
      sort_order: i,
      hsn_code: l.hsn_code,
    }));
    await supabase.from("invoice_lines").insert(lines);
  }

  // Increment org number and advance schedule
  await supabase
    .from("organizations")
    .update({ invoice_next_number: num + 1 })
    .eq("id", schedule.org_id);

  await supabase
    .from("recurring_invoices")
    .update({
      last_generated_at: new Date().toISOString(),
      next_run_date: advanceDate(schedule.next_run_date, schedule.frequency as Frequency),
    })
    .eq("id", scheduleId);

  return newInv.id;
}
