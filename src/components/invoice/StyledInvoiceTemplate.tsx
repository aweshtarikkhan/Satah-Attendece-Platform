import { QRCodeSVG } from "qrcode.react";

interface StyledInvoiceTemplateProps {
  org: any;
  invoice: any;
  lines: any[];
  fmt: (n: number) => string;
  type?: "invoice" | "estimate" | "bill" | "po";
  taxBreakdown?: { name: string; amount: number }[];
}

const getTitleText = (type: string, variant: string) => {
  if (type === "estimate") return variant === "minimal" || variant === "magnam" ? "Estimate" : "ESTIMATE";
  if (type === "po") return variant === "minimal" || variant === "magnam" ? "Purchase Order" : "PURCHASE ORDER";
  if (type === "bill") return variant === "minimal" || variant === "magnam" ? "Bill" : "BILL";
  return variant === "minimal" || variant === "magnam" ? "Invoice" : "TAX INVOICE";
};

/**
 * Generic invoice renderer that adapts its visual style based on
 * org.template_style. This makes the chosen template actually visible
 * on the invoice detail / preview page (not just on the printed PDF).
 *
 * Supported styles: classic, modern, minimal, professional, asperiores,
 * magnam, quisquam, nobis. (compact + pos have their own dedicated files.)
 */
export function StyledInvoiceTemplate({ org, invoice, lines, fmt, type = "invoice", taxBreakdown }: StyledInvoiceTemplateProps) {
  const style = (org?.template_style as string) || "classic";
  const accent = (org?.template_accent_color as string) || "#2563eb";
  const font = (org?.template_font as string) || "Inter, system-ui, sans-serif";
  const showLogo = org?.template_show_logo !== false;

  const clientName = (invoice.clients as any)?.display_name || "";
  const clientGst = (invoice.clients as any)?.tax_number;
  const number = type === "estimate" ? invoice.estimate_number : invoice.invoice_number;
  const balanceDue = type === "estimate" ? Number(invoice.total) : Number(invoice.balance_due ?? invoice.total);

  const addressLines: string[] = [];
  if (org?.address) {
    try {
      const a = typeof org.address === "string" ? JSON.parse(org.address) : org.address;
      if (a?.street) addressLines.push(a.street);
      const cityLine = [a?.city, a?.state, a?.zip].filter(Boolean).join(", ");
      if (cityLine) addressLines.push(cityLine);
      if (a?.country) addressLines.push(a.country);
    } catch {}
  }

  /* ------------ per-style visual tokens ------------- */
  const variants: Record<string, {
    header: React.CSSProperties;
    title: React.CSSProperties;
    sectionTitle: React.CSSProperties;
    tableHeader: React.CSSProperties;
    accentBar?: React.CSSProperties;
    container?: React.CSSProperties;
    titleText: string;
    align: "left" | "center" | "right";
  }> = {
    classic: {
      header: { borderBottom: `2px solid ${accent}`, paddingBottom: 16, marginBottom: 16 },
      title: { color: accent, fontWeight: 800, fontSize: 22, letterSpacing: 1 },
      sectionTitle: { color: accent, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
      tableHeader: { background: `${accent}10`, color: accent, fontWeight: 700 },
      titleText: getTitleText(type, "classic"),
      align: "right",
    },
    modern: {
      header: { background: accent, color: "#fff", padding: 20, borderRadius: 14, marginBottom: 20 },
      title: { color: "#fff", fontWeight: 800, fontSize: 26, letterSpacing: 0.5 },
      sectionTitle: { color: accent, fontWeight: 700, fontSize: 12, textTransform: "uppercase" },
      tableHeader: { background: `${accent}15`, color: accent, fontWeight: 700, borderRadius: 8 },
      accentBar: { background: accent, height: 4, borderRadius: 4, marginTop: 12 },
      titleText: getTitleText(type, "modern"),
      align: "right",
    },
    minimal: {
      header: { borderBottom: `1px solid #e5e7eb`, paddingBottom: 18, marginBottom: 22 },
      title: { color: "#111", fontWeight: 300, fontSize: 28, letterSpacing: 4 },
      sectionTitle: { color: "#666", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: 2 },
      tableHeader: { borderBottom: "1px solid #e5e7eb", color: "#111", fontWeight: 600 },
      titleText: getTitleText(type, "minimal"),
      align: "right",
    },
    professional: {
      header: { borderTop: `4px solid ${accent}`, borderBottom: `1px solid #ddd`, padding: "16px 0", marginBottom: 18 },
      title: { color: accent, fontWeight: 700, fontSize: 20 },
      sectionTitle: { color: accent, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
      tableHeader: { background: `${accent}10`, color: accent, fontWeight: 700, borderTop: `2px solid ${accent}` },
      titleText: getTitleText(type, "professional"),
      align: "right",
    },
    asperiores: {
      header: { background: "#111", color: "#fff", padding: 22, marginBottom: 20 },
      title: { color: accent, fontWeight: 900, fontSize: 28, letterSpacing: 1 },
      sectionTitle: { color: "#111", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 },
      tableHeader: { background: "#111", color: "#fff", fontWeight: 700 },
      titleText: getTitleText(type, "asperiores"),
      align: "right",
    },
    magnam: {
      header: { borderBottom: `1px solid ${accent}50`, paddingBottom: 18, marginBottom: 22, textAlign: "center" as const },
      title: { color: accent, fontWeight: 600, fontSize: 26, fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: 2 },
      sectionTitle: { color: accent, fontWeight: 600, fontSize: 12, fontFamily: "Georgia, serif", letterSpacing: 1 },
      tableHeader: { borderBottom: `1px solid ${accent}50`, color: accent, fontWeight: 600, fontFamily: "Georgia, serif" },
      titleText: getTitleText(type, "magnam"),
      align: "center",
    },
    quisquam: {
      header: { borderLeft: `6px solid ${accent}`, paddingLeft: 20, marginBottom: 24, background: "#f8f9fa", padding: 20 },
      title: { color: "#222", fontWeight: 800, fontSize: 24, textTransform: "uppercase" },
      sectionTitle: { color: accent, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
      tableHeader: { background: "#e5e7eb", color: "#333", fontWeight: 700 },
      titleText: getTitleText(type, "quisquam"),
      align: "left",
    },
    nobis: {
      header: { border: `2px solid ${accent}`, padding: 24, borderRadius: 16, marginBottom: 24 },
      title: { color: accent, fontWeight: 900, fontSize: 26, letterSpacing: -0.5 },
      sectionTitle: { color: "#333", fontWeight: 700, fontSize: 12, textTransform: "uppercase" },
      tableHeader: { background: accent, color: "#fff", fontWeight: 700, borderRadius: 6 },
      titleText: getTitleText(type, "nobis"),
      align: "center",
    },
  };

  const v = variants[style] || variants.classic;
  const isCenter = v.align === "center";

  return (
    <div
      className="bg-card text-card-foreground"
      style={{
        fontFamily: font,
        fontSize: 13,
        lineHeight: 1.5,
        padding: 28,
        color: "inherit",
        ...v.container,
      }}
    >
      {/* Header */}
      <div style={v.header}>
        <div
          style={{
            display: "flex",
            justifyContent: isCenter ? "center" : "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexDirection: isCenter ? "column" : "row",
            textAlign: isCenter ? "center" : "left",
          }}
        >
          <div>
            {showLogo && org?.logo_url && (
              <img src={org.logo_url} alt={org.name} style={{ maxHeight: 56, marginBottom: 8 }} />
            )}
            <div style={{ ...v.title }}>{org?.name}</div>
            {addressLines.map((l, i) => (
              <div key={i} style={{ fontSize: 12, opacity: 0.85 }}>{l}</div>
            ))}
            {org?.phone && <div style={{ fontSize: 12, opacity: 0.85 }}>Tel: {org.phone}</div>}
            {org?.email && <div style={{ fontSize: 12, opacity: 0.85 }}>{org.email}</div>}
            {org?.gst_enabled && org?.gst_number && (
              <div style={{ fontSize: 12, opacity: 0.85 }}>GSTIN: {org.gst_number}</div>
            )}
          </div>
          <div style={{ textAlign: isCenter ? "center" : "right" }}>
            <div style={{ ...v.title, fontSize: 18 }}>{v.titleText}</div>
            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600 }}>#{number}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Date: {invoice.issue_date}</div>
            {type === "invoice" && invoice.due_date && (
              <div style={{ fontSize: 12, opacity: 0.8 }}>Due: {invoice.due_date}</div>
            )}
            {type === "estimate" && invoice.expiry_date && (
              <div style={{ fontSize: 12, opacity: 0.8 }}>Valid till: {invoice.expiry_date}</div>
            )}
            {type === "po" && invoice.expected_date && (
              <div style={{ fontSize: 12, opacity: 0.8 }}>Expected By: {invoice.expected_date}</div>
            )}
          </div>
        </div>
        {v.accentBar && <div style={v.accentBar} />}
      </div>

      {/* Bill To */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
        <div>
          <div style={v.sectionTitle}>Bill To</div>
          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{clientName}</div>
          {clientGst && org?.gst_enabled && org?.show_client_gst && (
            <div style={{ fontSize: 12, opacity: 0.85 }}>GSTIN: {clientGst}</div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={v.sectionTitle}>Balance Due</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: accent, marginTop: 4 }}>
            {fmt(balanceDue)}
          </div>
        </div>
      </div>

      {/* Items */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ ...v.tableHeader, padding: "8px 10px", textAlign: "left", width: 28 }}>#</th>
            <th style={{ ...v.tableHeader, padding: "8px 10px", textAlign: "left" }}>Item &amp; Description</th>
            <th style={{ ...v.tableHeader, padding: "8px 10px", textAlign: "center", width: 70 }}>Qty</th>
            <th style={{ ...v.tableHeader, padding: "8px 10px", textAlign: "right", width: 90 }}>Rate</th>
            <th style={{ ...v.tableHeader, padding: "8px 10px", textAlign: "right", width: 100 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={line.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "8px 10px", verticalAlign: "top" }}>{idx + 1}</td>
              <td style={{ padding: "8px 10px" }}>
                <div style={{ fontWeight: 600 }}>{line.name}</div>
                {line.description && <div style={{ fontSize: 11, opacity: 0.75 }}>{line.description}</div>}
              </td>
              <td style={{ padding: "8px 10px", textAlign: "center", verticalAlign: "top" }}>
                {line.quantity}
                {line.unit && <div style={{ fontSize: 10, opacity: 0.7 }}>{line.unit}</div>}
                {org?.sub_unit_enabled && (line as any).sub_unit && (
                  <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>
                    = {Number(line.quantity) * Number((line as any).sub_unit_conversion_rate || 1)} {(line as any).sub_unit}
                  </div>
                )}
              </td>
              <td style={{ padding: "8px 10px", textAlign: "right", verticalAlign: "top" }}>
                {Number(line.rate).toFixed(2)}
              </td>
              <td style={{ padding: "8px 10px", textAlign: "right", verticalAlign: "top", fontWeight: 600 }}>
                {fmt(Number(line.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ minWidth: 260, fontSize: 13 }}>
          <Row label="Subtotal" value={fmt(Number(invoice.subtotal ?? invoice.total))} />
          {Number(invoice.total_discount) > 0 && (
            <Row label="Discount" value={`-${fmt(Number(invoice.total_discount))}`} />
          )}
          {taxBreakdown && taxBreakdown.length > 0 ? (
            taxBreakdown.map((t, idx) => (
              <Row key={idx} label={t.name} value={fmt(t.amount)} />
            ))
          ) : Number(invoice.total_tax) > 0 ? (
            <Row label="Tax" value={fmt(Number(invoice.total_tax))} />
          ) : null}
          {Number(invoice.shipping_charge) > 0 && (
            <Row label="Shipping" value={fmt(Number(invoice.shipping_charge))} />
          )}
          {Number(invoice.adjustment) !== 0 && (
            <Row label={invoice.adjustment_name || "Adjustment"} value={Number(invoice.adjustment).toFixed(2)} />
          )}
          {invoice.tds_tcs_applicable && Number(invoice.tds_tcs_amount) > 0 && (
            <Row 
              label={`${invoice.tds_tcs_type?.toUpperCase() || 'TDS'} (${invoice.tds_tcs_rate || 0}%)`} 
              value={`${invoice.tds_tcs_type === 'tds' ? '-' : '+'}${fmt(Number(invoice.tds_tcs_amount))}`} 
            />
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              marginTop: 6,
              borderTop: `2px solid ${accent}`,
              borderBottom: `2px solid ${accent}`,
              fontWeight: 800,
              fontSize: 15,
              color: accent,
            }}
          >
            <span>Total</span>
            <span>{fmt(Number(invoice.total))}</span>
          </div>
          {type === "invoice" && Number(invoice.amount_paid) > 0 && (
            <Row label="Amount Paid" value={fmt(Number(invoice.amount_paid))} />
          )}
          {type === "invoice" && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                fontWeight: 800,
                fontSize: 14,
                color: accent,
              }}
            >
              <span>Balance Due</span>
              <span>{fmt(balanceDue)}</span>
            </div>
          )}
        </div>
      </div>

      {/* QR */}
      {org?.qr_code_enabled && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px dashed #ddd", display: "flex", alignItems: "center", gap: 16 }}>
          <QRCodeSVG
            value={
              org?.upi_id
                ? `upi://pay?pa=${org.upi_id}&pn=${encodeURIComponent(org.name || "")}&am=${balanceDue.toFixed(2)}&cu=${invoice.currency_code || "INR"}&tn=${encodeURIComponent(`Payment for ${number}`)}`
                : `${window.location.origin}/portal/invoice/${invoice.id}`
            }
            size={110}
            level="M"
          />
          <div style={{ fontSize: 12 }}>
            <div style={{ ...v.sectionTitle }}>{org?.upi_id ? "Pay via UPI" : "Scan to view"}</div>
            {org?.upi_id && (
              <>
                <div style={{ marginTop: 4 }}>UPI: <b>{org.upi_id}</b></div>
                <div>Amount: <b>{fmt(balanceDue)}</b></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Notes / Terms */}
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 18, fontSize: 12 }}>
          {invoice.notes && (
            <div style={{ marginBottom: 8 }}>
              <div style={v.sectionTitle}>Notes</div>
              <div style={{ marginTop: 4, whiteSpace: "pre-wrap", opacity: 0.85 }}>{invoice.notes}</div>
            </div>
          )}
          {invoice.terms && (
            <div>
              <div style={v.sectionTitle}>Terms &amp; Conditions</div>
              <div style={{ marginTop: 4, whiteSpace: "pre-wrap", opacity: 0.85 }}>{invoice.terms}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
      <span style={{ opacity: 0.8 }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
