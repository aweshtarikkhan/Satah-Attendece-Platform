import { supabase } from "@/integrations/supabase/client";

/** Get an existing portal token or create one for the given entity. */
export async function getOrCreatePortalToken(
  orgId: string,
  entityType: "invoice" | "estimate" | "credit_note",
  entityId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("portal_tokens")
    .select("token")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (existing?.token) return existing.token;

  const { data, error } = await supabase
    .from("portal_tokens")
    .insert({ org_id: orgId, entity_type: entityType, entity_id: entityId })
    .select("token")
    .single();
  if (error) return null;
  return data?.token ?? null;
}

/** Build the public portal URL for a token. */
export function portalUrl(token: string): string {
  return `${window.location.origin}/portal/${token}`;
}

/** Normalize a phone number for WhatsApp (digits only, default India country code). */
export function normalizeWhatsappNumber(raw?: string | null, defaultCC = "91"): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // If looks like an Indian 10-digit, prepend default country code.
  if (digits.length === 10) return defaultCC + digits;
  return digits;
}

/** Open WhatsApp with a pre-filled message. Uses wa.me which works on web + mobile. */
export function openWhatsappShare(opts: {
  phone?: string | null;
  message: string;
}) {
  const phone = normalizeWhatsappNumber(opts.phone);
  const text = encodeURIComponent(opts.message);
  const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Compose a standard invoice WhatsApp message body. */
export function buildInvoiceWhatsappMessage(opts: {
  orgName?: string;
  clientName?: string;
  invoiceNumber: string;
  amountFormatted: string;
  dueDate?: string | null;
  portalLink?: string | null;
}) {
  const lines = [
    opts.clientName ? `Hello ${opts.clientName},` : "Hello,",
    "",
    `Please find your invoice *${opts.invoiceNumber}* for ${opts.amountFormatted}${
      opts.dueDate ? ` (due ${opts.dueDate})` : ""
    }.`,
  ];
  if (opts.portalLink) {
    lines.push("", `View & pay online: ${opts.portalLink}`);
  }
  if (opts.orgName) {
    lines.push("", `Thank you,`, opts.orgName);
  }
  return lines.join("\n");
}
