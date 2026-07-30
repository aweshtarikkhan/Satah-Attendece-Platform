import { supabase } from "@/integrations/supabase/client";

/**
 * Helpers to post double-entry journal entries for various business transactions.
 * Looks up system accounts by code so seed_default_accounting must have run for the org.
 */

async function getAccountMap(orgId: string) {
  const { data } = await (supabase as any).from("accounts").select("id,code").eq("org_id", orgId);
  const map: Record<string, string> = {};
  (data || []).forEach((a: any) => { map[a.code] = a.id; });
  return map;
}

async function createEntry(orgId: string, entryDate: string, narration: string, sourceType: string, sourceId: string, lines: { account_id: string; debit?: number; credit?: number; description?: string; branch_id?: string | null }[], branchId: string | null = null) {
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  const { data: entry, error } = await (supabase as any).from("journal_entries").insert({
    org_id: orgId, entry_date: entryDate, reference: sourceType + "/" + sourceId.slice(0, 8),
    narration, source_type: sourceType, source_id: sourceId,
    total_debit: totalDebit, total_credit: totalCredit, branch_id: branchId, is_posted: true,
  }).select().single();
  if (error) throw error;
  const payload = lines.filter(l => (l.debit || 0) > 0 || (l.credit || 0) > 0).map((l, idx) => ({
    org_id: orgId, entry_id: entry.id, account_id: l.account_id,
    debit: l.debit || 0, credit: l.credit || 0,
    description: l.description, sort_order: idx, branch_id: l.branch_id || branchId,
  }));
  if (payload.length) {
    const { error: e2 } = await (supabase as any).from("journal_lines").insert(payload);
    if (e2) throw e2;
  }
  return entry.id;
}

export async function postBillJournal(orgId: string, billId: string, billDate: string, billNumber: string, _vendorId: string, lines: any[], taxTotal: number, tdsAmount: number, total: number, branchId: string | null) {
  const acc = await getAccountMap(orgId);
  const ap = acc["2000"], inputGst = acc["1300"], tdsPayable = acc["2200"], fallbackExp = acc["5100"];
  const jl: any[] = [];
  // Debits: expense accounts (per line)
  lines.forEach((l: any) => {
    if (l.amount > 0) {
      jl.push({ account_id: l.account_id || fallbackExp, debit: Number(l.amount), description: l.description });
    }
  });
  if (taxTotal > 0 && inputGst) jl.push({ account_id: inputGst, debit: taxTotal, description: "Input GST" });
  // Credits: AP + TDS Payable
  if (tdsAmount > 0 && tdsPayable) jl.push({ account_id: tdsPayable, credit: tdsAmount, description: "TDS deducted" });
  if (ap) jl.push({ account_id: ap, credit: total, description: "Accounts Payable" });
  // Delete previous JE for same source, then post fresh
  await (supabase as any).from("journal_entries").delete().eq("source_type", "bill").eq("source_id", billId);
  await createEntry(orgId, billDate, `Bill ${billNumber}`, "bill", billId, jl, branchId);
}

export async function postBillPaymentJournal(orgId: string, paymentId: string, payDate: string, billNumber: string, _vendorId: string, amount: number, method: string, branchId: string | null) {
  const acc = await getAccountMap(orgId);
  const ap = acc["2000"];
  const credit = method === "cash" ? acc["1000"] : acc["1010"];
  if (!ap || !credit) return;
  await (supabase as any).from("journal_entries").delete().eq("source_type", "bill_payment").eq("source_id", paymentId);
  await createEntry(orgId, payDate, `Payment for ${billNumber}`, "bill_payment", paymentId, [
    { account_id: ap, debit: amount, description: "AP settlement" },
    { account_id: credit, credit: amount, description: `Paid via ${method}` },
  ], branchId);
}

export async function postInvoiceJournal(orgId: string, invoiceId: string, invDate: string, invNumber: string, subtotal: number, taxTotal: number, total: number, branchId: string | null) {
  const acc = await getAccountMap(orgId);
  const ar = acc["1100"], sales = acc["4000"], outGst = acc["2100"];
  if (!ar || !sales) return;
  const jl: any[] = [
    { account_id: ar, debit: total, description: "Accounts Receivable" },
    { account_id: sales, credit: subtotal, description: "Sales" },
  ];
  if (taxTotal > 0 && outGst) jl.push({ account_id: outGst, credit: taxTotal, description: "Output GST" });
  await (supabase as any).from("journal_entries").delete().eq("source_type", "invoice").eq("source_id", invoiceId);
  await createEntry(orgId, invDate, `Invoice ${invNumber}`, "invoice", invoiceId, jl, branchId);
}

export async function postPaymentJournal(orgId: string, paymentId: string, payDate: string, ref: string, amount: number, method: string, branchId: string | null) {
  const acc = await getAccountMap(orgId);
  const ar = acc["1100"];
  const debit = method === "cash" ? acc["1000"] : acc["1010"];
  if (!ar || !debit) return;
  await (supabase as any).from("journal_entries").delete().eq("source_type", "payment").eq("source_id", paymentId);
  await createEntry(orgId, payDate, `Payment received ${ref}`, "payment", paymentId, [
    { account_id: debit, debit: amount, description: `Received via ${method}` },
    { account_id: ar, credit: amount, description: "AR settlement" },
  ], branchId);
}
