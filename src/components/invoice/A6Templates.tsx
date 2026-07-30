import { QRCodeSVG } from "qrcode.react";

interface Props {
  org: any;
  invoice: any;
  lines: any[];
  fmt: (n: number) => string;
  type?: "invoice" | "estimate";
  variant: "alpha_blue" | "monochrome" | "amanda_cream" | "redblue_modern";
  taxBreakdown?: { name: string; amount: number }[];
}

function getAddressLines(org: any): string[] {
  const out: string[] = [];
  if (!org?.address) return out;
  try {
    const a = typeof org.address === "string" ? JSON.parse(org.address) : org.address;
    if (a?.street) out.push(a.street);
    const cl = [a?.city, a?.state, a?.zip].filter(Boolean).join(", ");
    if (cl) out.push(cl);
    if (a?.country) out.push(a.country);
  } catch {}
  return out;
}

function splitDate(d?: string) {
  if (!d) return { day: "", month: "", year: "" };
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return { day: "", month: "", year: "" };
  return {
    day: String(dt.getDate()).padStart(2, "0"),
    month: String(dt.getMonth() + 1).padStart(2, "0"),
    year: String(dt.getFullYear()),
  };
}

export function A6Template({ org, invoice, lines, fmt, type = "invoice", variant, taxBreakdown }: Props) {
  const accent = (org?.template_accent_color as string) || (variant === "redblue_modern" ? "#1e3a8a" : "#2563eb");
  const number = type === "estimate" ? invoice.estimate_number : invoice.invoice_number;
  const balanceDue = type === "estimate" ? Number(invoice.total) : Number(invoice.balance_due ?? invoice.total);
  const clientName = (invoice.clients as any)?.display_name || "";
  const clientEmail = (invoice.clients as any)?.email || "";
  const addr = getAddressLines(org);
  const showLogo = org?.template_show_logo !== false;
  const upiLink = org?.upi_id
    ? `upi://pay?pa=${org.upi_id}&pn=${encodeURIComponent(org.name || "")}&am=${balanceDue.toFixed(2)}&cu=${invoice.currency_code || "INR"}&tn=${encodeURIComponent(`Payment for ${number}`)}`
    : `${window.location.origin}/portal/invoice/${invoice.id}`;

  if (variant === "alpha_blue") {
    const { day, month, year } = splitDate(invoice.issue_date);
    return (
      <div className="bg-white text-slate-900 p-4" style={{ fontFamily: "Arial, sans-serif", fontSize: 11 }}>
        <div className="text-center mb-3">
          <h1 className="font-extrabold tracking-wider" style={{ color: accent, fontSize: 22 }}>{org?.name?.toUpperCase()}</h1>
          {org?.tagline && <p className="text-[10px] uppercase tracking-wide">{org.tagline}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="font-bold text-[11px]" style={{ color: accent }}>OFFICE ADDRESS</p>
            {addr.map((l, i) => <p key={i} className="text-[10px]">{l}</p>)}
            <div className="mt-2 border-2 rounded-md p-2" style={{ borderColor: accent }}>
              <p className="text-[10px]"><b>Name:</b> {clientName}</p>
              <p className="text-[10px]"><b>Email:</b> {clientEmail}</p>
              <p className="text-[10px]"><b>Phone:</b> {(invoice.clients as any)?.phone || ""}</p>
            </div>
          </div>
          <div>
            <div className="inline-block px-2 py-1 font-bold text-[12px]" style={{ background: "#facc15", color: "#0f172a" }}>
              {type === "estimate" ? "ESTIMATE" : "SALES INVOICE"}
            </div>
            <p className="mt-2 font-bold" style={{ color: accent }}>#{number}</p>
            {org?.phone && <p className="text-[10px] mt-1">TEL: {org.phone}</p>}
            <table className="mt-2 border-collapse text-[10px]">
              <thead>
                <tr>
                  {["DAY", "MONTH", "YEAR"].map((h) => (
                    <th key={h} className="border px-2 py-0.5 font-bold text-white" style={{ background: accent, borderColor: accent }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-0.5 text-center" style={{ borderColor: accent }}>{day}</td>
                  <td className="border px-2 py-0.5 text-center" style={{ borderColor: accent }}>{month}</td>
                  <td className="border px-2 py-0.5 text-center" style={{ borderColor: accent }}>{year}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <table className="w-full border-2 text-[10px]" style={{ borderColor: accent }}>
          <thead>
            <tr style={{ background: `${accent}20`, color: accent }}>
              <th className="border px-1 py-1 text-left w-10" style={{ borderColor: accent }}>QTY</th>
              <th className="border px-1 py-1 text-left" style={{ borderColor: accent }}>DESCRIPTION</th>
              <th className="border px-1 py-1 text-right w-14" style={{ borderColor: accent }}>PRICE</th>
              <th className="border px-1 py-1 text-right w-14" style={{ borderColor: accent }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="border px-1 py-1" style={{ borderColor: accent }}>{l.quantity}{l.unit ? ` ${l.unit}` : ""}</td>
                <td className="border px-1 py-1" style={{ borderColor: accent }}>{l.name}</td>
                <td className="border px-1 py-1 text-right" style={{ borderColor: accent }}>{Number(l.rate).toFixed(2)}</td>
                <td className="border px-1 py-1 text-right" style={{ borderColor: accent }}>{fmt(Number(l.amount))}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="border px-1 py-1 text-right font-bold" style={{ borderColor: accent }}>TOTAL</td>
              <td className="border px-1 py-1 text-right font-bold" style={{ borderColor: accent }}>{fmt(Number(invoice.total))}</td>
            </tr>
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-4 mt-6 text-[10px]">
          <div className="border-t pt-1 text-center">Customer's Signature</div>
          <div className="border-t pt-1 text-center">Authorized Signature</div>
        </div>
        <p className="text-center italic mt-3 text-[10px]" style={{ color: accent }}>Thanks for your patronage</p>
      </div>
    );
  }

  if (variant === "monochrome") {
    return (
      <div className="bg-white text-black p-4" style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: 11 }}>
        <div className="flex justify-between items-start mb-3">
          <h1 className="font-black text-3xl tracking-tight">{type === "estimate" ? "Estimate" : "Invoice"}</h1>
          <div className="text-right text-[10px]">
            <p className="font-bold">{org?.name}</p>
            {addr.map((l, i) => <p key={i}>{l}</p>)}
            {org?.phone && <p>{org.phone}</p>}
          </div>
        </div>
        <div className="flex justify-between text-[10px] mb-2">
          <div><span className="font-semibold">{type === "estimate" ? "Estimate #" : "Invoice #"}</span> {number}</div>
          <div><span className="font-semibold">Date</span> {invoice.issue_date}</div>
        </div>
        <div className="bg-black text-white px-2 py-1 font-bold text-[11px] mb-1">BILL TO</div>
        <div className="text-[10px] mb-2 border-b border-black pb-1">
          <p className="font-semibold">{clientName}</p>
          {clientEmail && <p>{clientEmail}</p>}
        </div>
        <div className="bg-black text-white px-2 py-1 font-bold text-[11px] mb-1">PRODUCTS OR SERVICES</div>
        <table className="w-full border border-black text-[10px]">
          <thead>
            <tr className="border-b border-black">
              <th className="px-1 py-1 text-left border-r border-black">Description</th>
              <th className="px-1 py-1 text-right border-r border-black w-12">Cost</th>
              <th className="px-1 py-1 text-right border-r border-black w-10">Qty</th>
              <th className="px-1 py-1 text-right w-14">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-black/30">
                <td className="px-1 py-1 border-r border-black/30">{l.name}</td>
                <td className="px-1 py-1 text-right border-r border-black/30">{Number(l.rate).toFixed(2)}</td>
                <td className="px-1 py-1 text-right border-r border-black/30">
                  {l.quantity}
                  {org?.sub_unit_enabled && (l as any).sub_unit && (
                    <div className="text-[8px] opacity-75">
                      = {Number(l.quantity) * Number((l as any).sub_unit_conversion_rate || 1)} {(l as any).sub_unit}
                    </div>
                  )}
                </td>
                <td className="px-1 py-1 text-right">{fmt(Number(l.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-4 mt-3 text-[10px]">
          <div className="border border-black p-2 min-h-[60px]">
            <p className="font-bold mb-1">Notes</p>
            <p className="whitespace-pre-wrap">{invoice.notes || ""}</p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between"><span>Sub Total</span><span>{fmt(Number(invoice.subtotal ?? invoice.total))}</span></div>
            {taxBreakdown && taxBreakdown.length > 0 ? (
              taxBreakdown.map((t, idx) => <div key={idx} className="flex justify-between"><span>{t.name}</span><span>{fmt(t.amount)}</span></div>)
            ) : Number(invoice.total_tax) > 0 ? (
              <div className="flex justify-between"><span>Tax</span><span>{fmt(Number(invoice.total_tax))}</span></div>
            ) : null}
            {Number(invoice.shipping_charge) > 0 && <div className="flex justify-between border-b pb-1"><span>Shipping</span><span>{fmt(Number(invoice.shipping_charge))}</span></div>}
            {invoice.tds_tcs_applicable && Number(invoice.tds_tcs_amount) > 0 && (
              <div className="flex justify-between border-b pb-1"><span>{invoice.tds_tcs_type?.toUpperCase() || 'TDS'} ({invoice.tds_tcs_rate || 0}%)</span><span>{invoice.tds_tcs_type === 'tds' ? '-' : '+'}{fmt(Number(invoice.tds_tcs_amount))}</span></div>
            )}
            <div className="flex justify-between border-t-2 border-black pt-1 font-bold"><span>Total Due</span><span>{fmt(balanceDue)}</span></div>
          </div>
        </div>
        <p className="text-center mt-3 text-[10px]">Thank you for your purchase!</p>
      </div>
    );
  }

  if (variant === "amanda_cream") {
    return (
      <div className="p-4" style={{ background: "#fdf6dd", color: "#0a0a0a", fontFamily: "Georgia, serif", fontSize: 11 }}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            {showLogo && org?.logo_url && <img src={org.logo_url} alt="" style={{ maxHeight: 50 }} />}
            <h1 className="font-black text-xl leading-tight">{org?.name}</h1>
          </div>
          <div className="text-right text-[10px]">
            {org?.phone && <p>📞 {org.phone}</p>}
            {org?.email && <p>✉ {org.email}</p>}
            {org?.website && <p>🌐 {org.website}</p>}
          </div>
        </div>
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="border-2 border-black rounded-md p-2 flex-1 min-h-[70px]">
            <p className="text-[11px] tracking-widest font-bold mb-1">CLIENT DETAILS:</p>
            <p className="font-semibold">{clientName}</p>
            {clientEmail && <p className="text-[10px]">{clientEmail}</p>}
          </div>
          <div className="text-right">
            <div className="inline-block bg-black text-[#fdf6dd] px-3 py-1 font-extrabold tracking-widest text-base">
              {type === "estimate" ? "ESTIMATE" : "RECEIPT"}
            </div>
            <p className="mt-2 text-[10px]"><b>DATE:</b> {invoice.issue_date}</p>
            <p className="text-[10px]"><b>{type === "estimate" ? "ESTIMATE NO." : "RECEIPT NO."}</b> {number}</p>
          </div>
        </div>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-black text-[#fdf6dd]">
              <th className="px-1 py-1 text-left w-8">No.</th>
              <th className="px-1 py-1 text-left">Description</th>
              <th className="px-1 py-1 text-right w-10">Units</th>
              <th className="px-1 py-1 text-right w-14">Price/unit</th>
              <th className="px-1 py-1 text-right w-14">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} className="border-b border-black/40">
                <td className="px-1 py-1">{i + 1}</td>
                <td className="px-1 py-1">{l.name}</td>
                <td className="px-1 py-1 text-right">{l.quantity}</td>
                <td className="px-1 py-1 text-right">{Number(l.rate).toFixed(2)}</td>
                <td className="px-1 py-1 text-right">{fmt(Number(l.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between mt-2 text-[10px]">
          <div className="font-bold">E&amp;OE</div>
          <div className="space-y-0.5 min-w-[140px]">
            <div className="flex justify-between border-b border-black/40 pb-0.5"><span className="font-bold">SUB TOTAL</span><span>{fmt(Number(invoice.subtotal ?? invoice.total))}</span></div>
            {taxBreakdown && taxBreakdown.length > 0 ? (
              taxBreakdown.map((t, idx) => <div key={idx} className="flex justify-between border-b border-black/40 pb-0.5"><span className="font-bold">{t.name}</span><span>{fmt(t.amount)}</span></div>)
            ) : (
              <div className="flex justify-between border-b border-black/40 pb-0.5"><span className="font-bold">TAXES</span><span>{fmt(Number(invoice.total_tax || 0))}</span></div>
            )}
            <div className="flex justify-between font-extrabold"><span>TOTAL</span><span>{fmt(Number(invoice.total))}</span></div>
          </div>
        </div>
        <div className="mt-4 -mx-4 -mb-4 bg-black text-[#fdf6dd] text-center py-2 font-bold tracking-widest text-[12px]">
          THANK YOU FOR YOUR BUSINESS!
          <p className="italic font-normal text-[9px] mt-0.5">Goods &amp; Money once received cannot be returned</p>
        </div>
      </div>
    );
  }

  // redblue_modern
  const navy = "#1e3a8a";
  const red = "#dc2626";
  return (
    <div className="bg-white text-slate-900 relative overflow-hidden" style={{ fontFamily: "Arial, sans-serif", fontSize: 11 }}>
      <div className="relative h-16">
        <div className="absolute inset-y-0 right-0 w-3/5" style={{ background: red, clipPath: "polygon(20% 0, 100% 0, 100% 100%, 0% 100%)" }} />
        <div className="absolute inset-x-0 top-12 h-3" style={{ background: navy }} />
        <div className="relative flex justify-between items-center px-4 pt-3">
          <h1 className="font-extrabold text-2xl tracking-tight" style={{ color: navy }}>{type === "estimate" ? "ESTIMATE" : "INVOICE"}</h1>
          <div className="text-white font-extrabold text-2xl tracking-wider">{showLogo && org?.logo_url ? <img src={org.logo_url} alt="" style={{ maxHeight: 36 }} /> : (org?.name || "LOGO")}</div>
        </div>
      </div>
      <div className="px-4 pt-4 pb-3">
        <div className="flex justify-between mb-3 text-[10px]">
          <div>
            <p className="font-bold">INVOICE TO:</p>
            <p className="font-extrabold text-[12px]">{clientName}</p>
            {clientEmail && <p>{clientEmail}</p>}
          </div>
          <div className="text-right">
            <p><b>{type === "estimate" ? "Estimate#" : "Invoice#"}</b> &nbsp; {number}</p>
            <p><b>Date</b> &nbsp; {invoice.issue_date}</p>
          </div>
        </div>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-white" style={{ background: navy }}>
              <th className="px-2 py-1 text-left w-8">SL.</th>
              <th className="px-2 py-1 text-left">Item Description</th>
              <th className="px-2 py-1 text-right w-14">Price</th>
              <th className="px-2 py-1 text-center w-10">Qty</th>
              <th className="px-2 py-1 text-right w-14">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} className="border-b border-slate-200 relative">
                <td className="px-2 py-1.5">{i + 1}</td>
                <td className="px-2 py-1.5">{l.name}</td>
                <td className="px-2 py-1.5 text-right">{fmt(Number(l.rate))}</td>
                <td className="px-2 py-1.5 text-center relative">
                  {l.quantity}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-0 h-1 w-3/4 flex">
                    <div className="flex-1" style={{ background: red }} />
                    <div className="flex-1" style={{ background: navy }} />
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right">{fmt(Number(l.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between mt-3 gap-3">
          <div className="text-[10px] flex-1">
            <p className="font-bold">Thank You For Your Business</p>
            {org?.upi_id && (
              <>
                <p className="font-bold mt-1">Payment Info:</p>
                <p>UPI: {org.upi_id}</p>
              </>
            )}
            {invoice.terms && (
              <>
                <p className="font-bold mt-1">Terms &amp; Conditions</p>
                <p className="opacity-80 whitespace-pre-wrap">{invoice.terms}</p>
              </>
            )}
          </div>
          <div className="text-[10px] min-w-[140px] space-y-0.5">
            <div className="flex justify-between"><span className="font-bold">Sub Total:</span><span>{fmt(Number(invoice.subtotal ?? invoice.total))}</span></div>
            {taxBreakdown && taxBreakdown.length > 0 ? (
              taxBreakdown.map((t, idx) => <div key={idx} className="flex justify-between"><span className="font-bold">{t.name}:</span><span>{fmt(t.amount)}</span></div>)
            ) : Number(invoice.total_tax) > 0 ? (
              <div className="flex justify-between"><span className="font-bold">Tax:</span><span>{fmt(Number(invoice.total_tax))}</span></div>
            ) : null}
            <div className="flex justify-between mt-1 px-2 py-1 text-white font-extrabold" style={{ background: navy }}>
              <span>Total</span><span>{fmt(Number(invoice.total))}</span>
            </div>
          </div>
        </div>
        {org?.qr_code_enabled && (
          <div className="mt-3 flex items-center gap-2">
            <QRCodeSVG value={upiLink} size={70} level="M" />
            <p className="text-[9px]">{org?.upi_id ? `Pay ${fmt(balanceDue)} via UPI` : "Scan to view"}</p>
          </div>
        )}
      </div>
      <div className="h-3" style={{ background: red, clipPath: "polygon(0 0, 80% 0, 100% 100%, 0 100%)" }} />
    </div>
  );
}
