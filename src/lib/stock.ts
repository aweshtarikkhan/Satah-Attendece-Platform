import { supabase } from "@/integrations/supabase/client";

export interface StockMovementInput {
  orgId: string;
  itemId: string;
  changeQty: number; // negative = stock out, positive = stock in
  balanceAfter?: number | null;
  reason: string;
  refType?: "invoice" | "credit_note" | "adjustment" | "manual" | null;
  refId?: string | null;
  refNumber?: string | null;
  createdBy?: string | null;
}

/** Insert a batch of stock movements. Best-effort: errors are swallowed but logged. */
export async function logStockMovements(movements: StockMovementInput[]) {
  if (!movements.length) return;
  const rows = movements.map((m) => ({
    org_id: m.orgId,
    item_id: m.itemId,
    change_qty: m.changeQty,
    balance_after: m.balanceAfter ?? null,
    reason: m.reason,
    ref_type: m.refType ?? null,
    ref_id: m.refId ?? null,
    ref_number: m.refNumber ?? null,
    created_by: m.createdBy ?? null,
  }));
  const { error } = await (supabase as any).from("stock_movements").insert(rows);
  if (error) console.warn("stock movement log failed:", error.message);
}

/** Detect which line items would push stock below zero. Returns warnings array. */
export async function detectNegativeStock(
  lineItems: { item_id: string | null; quantity: number; name: string }[],
  options: { restorePrevQty?: Record<string, number> } = {}
): Promise<{ name: string; available: number; requested: number }[]> {
  const restore = options.restorePrevQty || {};
  const needs: Record<string, number> = {};
  for (const l of lineItems) {
    if (!l.item_id || !l.quantity) continue;
    needs[l.item_id] = (needs[l.item_id] || 0) + Number(l.quantity);
  }
  const ids = Object.keys(needs);
  if (!ids.length) return [];
  const { data } = await supabase
    .from("items")
    .select("id, name, type, stock_quantity")
    .in("id", ids);
  const warnings: { name: string; available: number; requested: number }[] = [];
  for (const it of data || []) {
    if (it.type !== "product") continue;
    const effective = Number(it.stock_quantity || 0) + Number(restore[it.id] || 0);
    const requested = needs[it.id];
    if (requested > effective) {
      warnings.push({ name: it.name, available: effective, requested });
    }
  }
  return warnings;
}
