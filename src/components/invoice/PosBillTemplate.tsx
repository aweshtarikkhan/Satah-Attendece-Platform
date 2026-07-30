import { QRCodeSVG } from "qrcode.react";

interface PosBillTemplateProps {
  org: any;
  invoice: any;
  lines: any[];
  fmt: (n: number) => string;
  type?: "invoice" | "estimate" | "bill" | "po";
  taxBreakdown?: { name: string; amount: number }[];
}

/**
 * POS / Thermal printer style receipt.
 * Designed for 80mm (≈ 302px) roll paper. Uses monospace, dashed dividers,
 * compact rows and tiny fonts — exactly what cash register printers expect.
 */
export function PosBillTemplate({ org, invoice, lines, fmt, type = "invoice", taxBreakdown }: PosBillTemplateProps) {
  const clientName = (invoice.clients as any)?.display_name || "";
  const number = type === "estimate" ? invoice.estimate_number : (type === "po" ? invoice.po_number : invoice.invoice_number);
  const balanceDue = type === "estimate" ? Number(invoice.total) : Number(invoice.balance_due ?? invoice.total);
  const currencySymbol = org?.currency_code === "INR" ? "₹" : fmt(0).replace(/[\d.,]/g, "").trim() || "₹";

  const addressLines: string[] = [];
  if (org?.address) {
    const a = typeof org.address === "string" ? JSON.parse(org.address) : org.address;
    if (a?.street) addressLines.push(a.street);
    const cityLine = [a?.city, a?.state, a?.zip].filter(Boolean).join(", ");
    if (cityLine) addressLines.push(cityLine);
  }

  const money = (n: number) => `${currencySymbol}${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dashed = "------------------------------";

  return (
    <div
      className="bg-background text-foreground mx-auto"
      style={{
        fontFamily: "'Courier New', ui-monospace, monospace",
        fontSize: "12px",
        lineHeight: 1.35,
        width: "80mm",
        maxWidth: "100%",
        padding: "8px 10px",
        color: "#000",
      }}
    >
      {/* Header */}
      <div className="text-center" style={{ marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 15, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {org?.name}
        </div>
        {addressLines.map((l, i) => (
          <div key={i} style={{ fontSize: 11 }}>{l}</div>
        ))}
        {org?.phone && <div style={{ fontSize: 11 }}>Tel: {org.phone}</div>}
        {org?.gst_enabled && org?.gst_number && (
          <div style={{ fontSize: 11 }}>GSTIN: {org.gst_number}</div>
        )}
      </div>

      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13, margin: "4px 0", textTransform: "uppercase" }}>
        {type === "estimate" ? "Estimate" : (type === "po" ? "Purchase Order" : (type === "bill" ? "Bill" : "Tax Invoice"))}
      </div>
      <div style={{ textAlign: "center", letterSpacing: -1 }}>{dashed}</div>

      {/* Meta */}
      <div style={{ fontSize: 11, margin: "4px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{type === "estimate" ? "Est#" : type === "po" ? "PO#" : "Bill#"}: <b>{number}</b></span>
          <span>{invoice.issue_date}</span>
        </div>
        <div>Customer: <b>{clientName}</b></div>
        {(invoice.clients as any)?.tax_number && org?.gst_enabled && org?.show_client_gst && (
          <div>GSTIN: {(invoice.clients as any).tax_number}</div>
        )}
      </div>

      <div style={{ textAlign: "center", letterSpacing: -1 }}>{dashed}</div>

      {/* Items header */}
      <div style={{ display: "flex", fontSize: 11, fontWeight: 700, padding: "2px 0" }}>
        <div style={{ flex: 1 }}>Item</div>
        <div style={{ width: 30, textAlign: "right" }}>Qty</div>
        <div style={{ width: 50, textAlign: "right" }}>Rate</div>
        <div style={{ width: 60, textAlign: "right" }}>Amt</div>
      </div>
      <div style={{ textAlign: "center", letterSpacing: -1 }}>{dashed}</div>

      {/* Items */}
      {lines.map((line, idx) => (
        <div key={line.id || idx} style={{ fontSize: 11, padding: "2px 0" }}>
          <div style={{ fontWeight: 600 }}>
            {idx + 1}. {line.name}
          </div>
          <div style={{ display: "flex" }}>
            <div style={{ flex: 1, color: "#555", fontSize: 10 }}>
              {line.unit ? line.unit : ""}
              {line.description ? ` — ${line.description}` : ""}
              {org?.sub_unit_enabled && (line as any).sub_unit && (
                <div style={{ fontSize: 9 }}>
                  = {Number(line.quantity) * Number((line as any).sub_unit_conversion_rate || 1)} {(line as any).sub_unit}
                </div>
              )}
            </div>
            <div style={{ width: 30, textAlign: "right" }}>{line.quantity}</div>
            <div style={{ width: 50, textAlign: "right" }}>{Number(line.rate).toFixed(2)}</div>
            <div style={{ width: 60, textAlign: "right", fontWeight: 600 }}>
              {Number(line.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      ))}

      <div style={{ textAlign: "center", letterSpacing: -1 }}>{dashed}</div>

      {/* Totals */}
      <div style={{ fontSize: 11 }}>
        <Row label="Subtotal" value={money(Number(invoice.subtotal ?? invoice.total))} />
        {Number(invoice.total_discount) > 0 && (
          <Row label="Discount" value={`-${money(Number(invoice.total_discount))}`} />
        )}
        {taxBreakdown && taxBreakdown.length > 0 ? (
          taxBreakdown.map((t, idx) => (
            <Row key={idx} label={t.name} value={money(t.amount)} />
          ))
        ) : Number(invoice.total_tax) > 0 ? (
          <Row label="Tax" value={money(Number(invoice.total_tax))} />
        ) : null}
        {Number(invoice.shipping_charge) > 0 && (
          <Row label="Shipping" value={money(Number(invoice.shipping_charge))} />
        )}
        {Number(invoice.adjustment) !== 0 && (
          <Row label={invoice.adjustment_name || "Round Off"} value={Number(invoice.adjustment).toFixed(2)} />
        )}
        {invoice.tds_tcs_applicable && Number(invoice.tds_tcs_amount) > 0 && (
          <Row 
            label={`${invoice.tds_tcs_type?.toUpperCase() || 'TDS'} (${invoice.tds_tcs_rate || 0}%)`} 
            value={`${invoice.tds_tcs_type === 'tds' ? '-' : '+'}${money(Number(invoice.tds_tcs_amount))}`} 
          />
        )}
      </div>

      <div style={{ textAlign: "center", letterSpacing: -1 }}>{dashed}</div>

      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14, padding: "2px 0" }}>
        <span>TOTAL</span>
        <span>{money(Number(invoice.total))}</span>
      </div>

      {type !== "estimate" && Number(invoice.amount_paid) > 0 && (
        <Row label="Paid" value={money(Number(invoice.amount_paid))} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 13, padding: "4px 0", borderTop: "1px dashed #000", borderBottom: "1px dashed #000", margin: "4px 0" }}>
        <span>BALANCE DUE</span>
        <span>{money(balanceDue)}</span>
      </div>

      {/* QR */}
      {org?.qr_code_enabled && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 8 }}>
          <QRCodeSVG
            value={
              org?.upi_id
                ? `upi://pay?pa=${org.upi_id}&pn=${encodeURIComponent(org.name || "")}&am=${balanceDue.toFixed(2)}&cu=${invoice.currency_code || "INR"}&tn=${encodeURIComponent(`Payment for ${number}`)}`
                : `${window.location.origin}/portal/invoice/${invoice.id}`
            }
            size={110}
            level="M"
          />
          <div style={{ fontSize: 10, marginTop: 4, textAlign: "center" }}>
            {org?.upi_id ? "Scan & Pay via UPI" : "Scan to view invoice"}
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, fontStyle: "italic" }}>
        {invoice.notes || "Thank you! Visit again."}
      </div>
      <div style={{ textAlign: "center", letterSpacing: -1, marginTop: 4 }}>{dashed}</div>
      <div style={{ textAlign: "center", fontSize: 10, marginTop: 2 }}>
        *** This is a computer generated bill ***
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
