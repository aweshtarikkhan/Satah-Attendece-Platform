import { QRCodeSVG } from "qrcode.react";

interface CompactBillTemplateProps {
  org: any;
  invoice: any;
  lines: any[];
  fmt: (n: number) => string;
  type?: "invoice" | "estimate" | "bill" | "po";
  taxBreakdown?: { name: string; amount: number }[];
}

export function CompactBillTemplate({ org, invoice, lines, fmt, type = "invoice", taxBreakdown }: CompactBillTemplateProps) {
  const clientName = (invoice.clients as any)?.display_name || "";
  const invoiceNumber = type === "estimate" ? invoice.estimate_number : (type === "po" ? invoice.po_number : invoice.invoice_number);
  const balanceDue = type === "estimate" ? Number(invoice.total) : Number(invoice.balance_due ?? invoice.total);
  const currencySymbol = org?.currency_code === "INR" ? "₹" : fmt(0).replace(/[\d.,]/g, "").trim();

  const addressParts: string[] = [];
  if (org?.address) {
    const a = typeof org.address === "string" ? JSON.parse(org.address) : org.address;
    if (a.street) addressParts.push(a.street);
    if (a.city || a.state || a.zip) addressParts.push([a.city, a.state, a.zip].filter(Boolean).join(", "));
  }

  return (
    <div className="bg-background text-foreground px-4 py-6 font-sans w-full" style={{ fontFamily: "Arial, sans-serif", fontSize: "14px" }}>
      {/* Company Header - Centered */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wide text-primary">{org?.name}</h1>
        {addressParts.map((line, i) => (
          <p key={i} className="text-sm text-muted-foreground">{line}</p>
        ))}
        {org?.phone && <p className="text-sm text-muted-foreground">+91 {org.phone}</p>}
        {org?.gst_enabled && org?.gst_number && (
          <p className="text-sm text-muted-foreground">GSTIN: {org.gst_number}</p>
        )}
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-xl italic text-muted-foreground">
          {type === "estimate" ? "Estimated Bill" : (type === "po" ? "Purchase Order" : (type === "bill" ? "Bill" : "Tax Invoice"))}
        </h2>
      </div>

      {/* Bill To / Invoice Info */}
      <div className="border-t border-b border-foreground/30 py-3 mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="font-semibold text-primary">Bill To:</span>{" "}
          <span className="font-medium">{clientName}</span>
          {org?.gst_enabled && org?.show_client_gst && (invoice.clients as any)?.tax_number && (
            <p className="text-xs text-muted-foreground">GSTIN: {(invoice.clients as any).tax_number}</p>
          )}
        </div>
        <div className="text-right">
          <span className="font-semibold text-primary">{type === "estimate" ? "Estimate#" : (type === "po" ? "PO#" : (type === "bill" ? "Bill#" : "Invoice#"))}:</span>{" "}
          <span>{invoiceNumber}</span>
        </div>
        <div>
          <span className="font-semibold text-primary">Date:</span>{" "}
          <span>{invoice.issue_date ? format(new Date(invoice.issue_date), "dd/MM/yyyy") : "—"}</span>
        </div>
        {invoice.due_date && type !== "po" && (
          <div className="text-right">
            <span className="font-semibold text-primary">Due:</span>{" "}
            <span>{format(new Date(invoice.due_date), "dd/MM/yyyy")}</span>
          </div>
        )}
        {invoice.expected_date && type === "po" && (
          <div className="text-right">
            <span className="font-semibold text-primary">Expected By:</span>{" "}
            <span>{format(new Date(invoice.expected_date), "dd/MM/yyyy")}</span>
          </div>
        )}</div>

      {/* Items Table */}
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="border-b border-foreground/30">
            <th className="text-left py-2 w-8">#</th>
            <th className="text-left py-2">Item &amp; Description</th>
            <th className="text-center py-2">Qty</th>
            <th className="text-right py-2">Rate</th>
            <th className="text-right py-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={line.id} className="border-b border-muted/50">
              <td className="py-2 align-top">{idx + 1}</td>
              <td className="py-2">
                <span className="font-medium">{line.name}</span>
                {line.description && (
                  <span className="block text-muted-foreground text-xs">{line.description}</span>
                )}
              </td>
              <td className="text-center py-2 align-top">
                <span>{line.quantity}</span>
                {line.unit && (
                  <span className="block text-muted-foreground text-xs">{line.unit}</span>
                )}
                {org?.sub_unit_enabled && (line as any).sub_unit && (
                  <span className="block text-muted-foreground/60 text-[10px] mt-1">
                    = {Number(line.quantity) * Number((line as any).sub_unit_conversion_rate || 1)} {(line as any).sub_unit}
                  </span>
                )}
              </td>
              <td className="text-right py-2 align-top">{Number(line.rate).toFixed(2)}</td>
              <td className="text-right py-2 align-top font-medium">{Number(line.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t border-foreground/30 pt-3 space-y-1 text-sm">
        {Number(invoice.total_discount) > 0 && (
          <div className="flex justify-between">
            <span className="text-primary font-semibold">Discount</span>
            <span>-{fmt(Number(invoice.total_discount))}</span>
          </div>
        )}
        {taxBreakdown && taxBreakdown.length > 0 ? (
          taxBreakdown.map((t, idx) => (
            <div key={idx} className="flex justify-between">
              <span className="text-primary font-semibold">{t.name}</span>
              <span>{fmt(t.amount)}</span>
            </div>
          ))
        ) : Number(invoice.total_tax) > 0 ? (
          <div className="flex justify-between">
            <span className="text-primary font-semibold">Tax</span>
            <span>{fmt(Number(invoice.total_tax))}</span>
          </div>
        ) : null}
        {Number(invoice.shipping_charge) > 0 && (
          <div className="flex justify-between">
            <span className="text-primary font-semibold">Shipping</span>
            <span>{fmt(Number(invoice.shipping_charge))}</span>
          </div>
        )}
        {Number(invoice.adjustment) !== 0 && (
          <div className="flex justify-between">
            <span className="text-primary font-semibold">{invoice.adjustment_name || "Rounding"}</span>
            <span>{Number(invoice.adjustment).toFixed(2)}</span>
          </div>
        )}
        {invoice.tds_tcs_applicable && Number(invoice.tds_tcs_amount) > 0 && (
          <div className="flex justify-between">
            <span className="text-primary font-semibold">{invoice.tds_tcs_type?.toUpperCase() || 'TDS'} ({invoice.tds_tcs_rate || 0}%)</span>
            <span>{invoice.tds_tcs_type === 'tds' ? '-' : '+'}{fmt(Number(invoice.tds_tcs_amount))}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-foreground/30 pt-2 font-bold text-base">
          <span className="text-primary">Total</span>
          <span>{fmt(Number(invoice.total))}</span>
        </div>
      </div>

      {/* Balance Due */}
      <div className="mt-6 flex justify-between items-center">
        <span className="text-2xl font-extrabold uppercase tracking-wide text-destructive">BALANCE DUE</span>
        <span className="text-2xl font-extrabold text-destructive">{currencySymbol}{balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
      </div>

      {/* Divider */}
      <hr className="my-6 border-foreground/30" />

      {/* QR Code */}
      {org?.qr_code_enabled && (
        <div className="flex flex-col items-center mb-6">
          <QRCodeSVG
            value={
              org?.upi_id
                ? `upi://pay?pa=${org.upi_id}&pn=${encodeURIComponent(org.name || "")}&am=${balanceDue.toFixed(2)}&cu=${invoice.currency_code || "INR"}&tn=${encodeURIComponent(`Payment for ${invoiceNumber}`)}`
                : `${window.location.origin}/portal/invoice/${invoice.id}`
            }
            size={160}
            level="M"
          />
          <p className="text-sm text-muted-foreground mt-3">Scan the QR code to view the configured information.</p>
        </div>
      )}

      {/* Footer */}
      {invoice.notes && (
        <p className="text-center text-sm text-muted-foreground italic mt-4">{invoice.notes}</p>
      )}
      {!invoice.notes && (
        <p className="text-center text-sm text-muted-foreground italic mt-4">Thank you for your business!</p>
      )}
    </div>
  );
}
