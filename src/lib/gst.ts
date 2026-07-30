// GST Returns computation helpers (India)
// Reference: GSTR-1 JSON schema v3 (offline tool)

export interface InvoiceForGst {
  id: string;
  invoice_number: string;
  issue_date: string;
  total: number;
  subtotal: number;
  total_tax: number;
  total_discount: number;
  shipping_charge?: number;
  status: string;
  client_id: string;
  reverse_charge?: boolean;
}

export interface LineForGst {
  invoice_id: string;
  name: string;
  hsn_code?: string | null;
  quantity: number;
  rate: number;
  amount: number;      // taxable value (after discount, before tax)
  tax_amount: number;
  tax_id?: string | null;
  unit?: string | null;
}

export interface ClientForGst {
  id: string;
  display_name: string;
  tax_number?: string | null; // GSTIN
  billing_address?: any;
}

export interface TaxRateForGst {
  id: string;
  name: string;
  rate: number;
}

/** Extract 2-digit state code from a GSTIN (first two chars). */
export function stateCodeFromGstin(gstin?: string | null): string | null {
  if (!gstin) return null;
  const t = gstin.trim();
  if (t.length < 2) return null;
  const code = t.slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

/** Format YYYY-MM-DD to GSTR-1 date format DD-MM-YYYY. */
export function gstrDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

/** Format period as MMYYYY for GSTR-1 fp field. */
export function gstrPeriod(year: number, month1to12: number): string {
  return `${String(month1to12).padStart(2, "0")}${year}`;
}

interface TaxSplit {
  txval: number;  // taxable value
  rt: number;     // total tax rate (%)
  iamt: number;   // IGST
  camt: number;   // CGST
  samt: number;   // SGST
  csamt: number;  // CESS (unsupported, 0)
}

export function lineTaxSplit(line: LineForGst, taxRates: TaxRateForGst[], interstate: boolean): TaxSplit {
  const tax = line.tax_id ? taxRates.find((t) => t.id === line.tax_id) : undefined;
  const rt = tax ? Number(tax.rate) : 0;
  const totalTax = Number(line.tax_amount || 0);
  const txval = Number(line.amount || 0) - totalTax;
  return {
    txval,
    rt,
    iamt: interstate ? totalTax : 0,
    camt: interstate ? 0 : totalTax / 2,
    samt: interstate ? 0 : totalTax / 2,
    csamt: 0,
  };
}

function r2(n: number): number { return Math.round(n * 100) / 100; }

export interface BuildGstrInput {
  orgGstin: string;
  period: { year: number; month: number };
  invoices: InvoiceForGst[];
  lines: LineForGst[];
  clients: ClientForGst[];
  taxRates: TaxRateForGst[];
}

/** Filter invoices to the given month/year (issue_date). Excludes void/draft. */
export function filterInvoicesForPeriod(invoices: InvoiceForGst[], year: number, month: number) {
  return invoices.filter((inv) => {
    if (inv.status === "void" || inv.status === "draft") return false;
    const d = new Date(inv.issue_date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

/** Build GSTR-1 JSON (B2B, B2CS, HSN sections). */
export function buildGstr1Json(input: BuildGstrInput) {
  const { orgGstin, period, invoices, lines, clients, taxRates } = input;
  const orgState = stateCodeFromGstin(orgGstin);
  const clientById: Record<string, ClientForGst> = {};
  clients.forEach((c) => { clientById[c.id] = c; });
  const linesByInvoice: Record<string, LineForGst[]> = {};
  lines.forEach((l) => {
    (linesByInvoice[l.invoice_id] = linesByInvoice[l.invoice_id] || []).push(l);
  });

  // B2B: invoices where buyer has GSTIN, grouped by ctin
  const b2bMap: Record<string, any[]> = {};
  // B2CS: aggregated by (place_of_supply, rate)
  const b2csMap: Record<string, TaxSplit & { pos: string; sply_ty: string }> = {};
  // HSN: aggregated by hsn_code + rate
  const hsnMap: Record<string, { hsn_sc: string; desc: string; uqc: string; qty: number; txval: number; iamt: number; camt: number; samt: number; csamt: number; rt: number }> = {};

  let grossTurnover = 0;

  for (const inv of invoices) {
    const client = clientById[inv.client_id];
    const buyerGstin = (client?.tax_number || "").trim();
    const buyerState = stateCodeFromGstin(buyerGstin);
    const pos = buyerState || orgState || "00";
    const interstate = !!(orgState && buyerState && orgState !== buyerState);
    const invLines = linesByInvoice[inv.id] || [];
    grossTurnover += Number(inv.total || 0);

    // Group invoice lines by tax rate for itms aggregation
    const itemGroups: Record<string, TaxSplit> = {};
    for (const ln of invLines) {
      const split = lineTaxSplit(ln, taxRates, interstate);
      const key = String(split.rt);
      const g = itemGroups[key] || { txval: 0, rt: split.rt, iamt: 0, camt: 0, samt: 0, csamt: 0 };
      g.txval += split.txval;
      g.iamt += split.iamt;
      g.camt += split.camt;
      g.samt += split.samt;
      itemGroups[key] = g;

      // HSN aggregation (use rate too so different rates of same HSN are separate)
      const hsnCode = (ln.hsn_code || "").trim() || "9954";
      const hsnKey = `${hsnCode}|${split.rt}`;
      const h = hsnMap[hsnKey] || {
        hsn_sc: hsnCode,
        desc: ln.name?.split("\n")[0] || hsnCode,
        uqc: (ln.unit || "OTH").toUpperCase().slice(0, 3),
        qty: 0, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0, rt: split.rt,
      };
      h.qty += Number(ln.quantity || 0);
      h.txval += split.txval;
      h.iamt += split.iamt;
      h.camt += split.camt;
      h.samt += split.samt;
      hsnMap[hsnKey] = h;
    }

    if (buyerGstin && /^[0-9A-Z]{15}$/.test(buyerGstin)) {
      // B2B
      const itms = Object.values(itemGroups).map((g, i) => ({
        num: i + 1,
        itm_det: {
          txval: r2(g.txval),
          rt: g.rt,
          iamt: r2(g.iamt),
          camt: r2(g.camt),
          samt: r2(g.samt),
          csamt: r2(g.csamt),
        },
      }));
      const invObj = {
        inum: inv.invoice_number,
        idt: gstrDate(inv.issue_date),
        val: r2(Number(inv.total || 0)),
        pos,
        rchrg: inv.reverse_charge ? "Y" : "N",
        inv_typ: "R",
        itms,
      };
      (b2bMap[buyerGstin] = b2bMap[buyerGstin] || []).push(invObj);
    } else {
      // B2CS — aggregate by (pos, rate)
      for (const g of Object.values(itemGroups)) {
        const key = `${pos}|${g.rt}`;
        const cur = b2csMap[key] || { pos, sply_ty: interstate ? "INTER" : "INTRA", txval: 0, rt: g.rt, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        cur.txval += g.txval;
        cur.iamt += g.iamt;
        cur.camt += g.camt;
        cur.samt += g.samt;
        b2csMap[key] = cur;
      }
    }
  }

  const b2b = Object.entries(b2bMap).map(([ctin, inv]) => ({ ctin, inv }));
  const b2cs = Object.values(b2csMap).map((g) => ({
    sply_ty: g.sply_ty, rt: g.rt, typ: "OE", pos: g.pos,
    txval: r2(g.txval), iamt: r2(g.iamt), camt: r2(g.camt), samt: r2(g.samt), csamt: r2(g.csamt),
  }));
  const hsn = {
    data: Object.values(hsnMap).map((h, i) => ({
      num: i + 1,
      hsn_sc: h.hsn_sc,
      desc: h.desc,
      uqc: h.uqc,
      qty: r2(h.qty),
      rt: h.rt,
      txval: r2(h.txval),
      iamt: r2(h.iamt),
      camt: r2(h.camt),
      samt: r2(h.samt),
      csamt: r2(h.csamt),
    })),
  };

  return {
    gstin: orgGstin,
    fp: gstrPeriod(period.year, period.month),
    gt: r2(grossTurnover),
    cur_gt: r2(grossTurnover),
    b2b,
    b2cs,
    hsn,
  };
}

/** Build GSTR-3B summary (outward supplies + tax payable). */
export function buildGstr3bSummary(input: BuildGstrInput) {
  const { orgGstin, invoices, lines, clients, taxRates } = input;
  const orgState = stateCodeFromGstin(orgGstin);
  const clientById: Record<string, ClientForGst> = {};
  clients.forEach((c) => { clientById[c.id] = c; });
  const linesByInvoice: Record<string, LineForGst[]> = {};
  lines.forEach((l) => {
    (linesByInvoice[l.invoice_id] = linesByInvoice[l.invoice_id] || []).push(l);
  });

  let taxable = 0, igst = 0, cgst = 0, sgst = 0;
  let outwardTaxable = 0; // section 3.1(a) - outward taxable supplies (other than zero rated, nil rated and exempted)
  let nilRatedExempt = 0;

  for (const inv of invoices) {
    const client = clientById[inv.client_id];
    const buyerState = stateCodeFromGstin(client?.tax_number);
    const interstate = !!(orgState && buyerState && orgState !== buyerState);
    const invLines = linesByInvoice[inv.id] || [];
    for (const ln of invLines) {
      const split = lineTaxSplit(ln, taxRates, interstate);
      taxable += split.txval;
      igst += split.iamt;
      cgst += split.camt;
      sgst += split.samt;
      if (split.rt > 0) outwardTaxable += split.txval;
      else nilRatedExempt += split.txval;
    }
  }

  return {
    "3.1(a)_outward_taxable": r2(outwardTaxable),
    "3.1(c)_nil_exempt": r2(nilRatedExempt),
    total_taxable_value: r2(taxable),
    integrated_tax_igst: r2(igst),
    central_tax_cgst: r2(cgst),
    state_tax_sgst: r2(sgst),
    total_tax_payable: r2(igst + cgst + sgst),
  };
}

/** Build HSN-wise summary rows. */
export function buildHsnSummary(input: BuildGstrInput) {
  const json = buildGstr1Json(input);
  return json.hsn.data;
}

/** Download a JSON blob as a file. */
export function downloadJson(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Download CSV (Tally-friendly). */
export function downloadCsv(filename: string, rows: Record<string, any>[], headers?: string[]) {
  if (!rows.length) {
    const blob = new Blob([""], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const cols = headers || Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Build Tally-friendly Sales Voucher CSV rows. */
export function buildTallySalesCsv(input: BuildGstrInput) {
  const { invoices, lines, clients, taxRates, orgGstin } = input;
  const orgState = stateCodeFromGstin(orgGstin);
  const clientById: Record<string, ClientForGst> = {};
  clients.forEach((c) => { clientById[c.id] = c; });
  const linesByInvoice: Record<string, LineForGst[]> = {};
  lines.forEach((l) => {
    (linesByInvoice[l.invoice_id] = linesByInvoice[l.invoice_id] || []).push(l);
  });

  const rows: Record<string, any>[] = [];
  for (const inv of invoices) {
    const client = clientById[inv.client_id];
    const buyerState = stateCodeFromGstin(client?.tax_number);
    const interstate = !!(orgState && buyerState && orgState !== buyerState);
    const invLines = linesByInvoice[inv.id] || [];
    for (const ln of invLines) {
      const split = lineTaxSplit(ln, taxRates, interstate);
      rows.push({
        "Voucher Date": gstrDate(inv.issue_date),
        "Voucher Type": "Sales",
        "Voucher Number": inv.invoice_number,
        "Party Name": client?.display_name || "",
        "Party GSTIN": client?.tax_number || "",
        "Item Name": ln.name,
        "HSN/SAC": ln.hsn_code || "",
        "Unit": ln.unit || "",
        "Quantity": ln.quantity,
        "Rate": ln.rate,
        "Taxable Value": r2(split.txval),
        "GST Rate %": split.rt,
        "IGST": r2(split.iamt),
        "CGST": r2(split.camt),
        "SGST": r2(split.samt),
        "Total": r2(split.txval + split.iamt + split.camt + split.samt),
      });
    }
  }
  return rows;
}


export function buildGstr2Json(input: {
  orgGstin: string;
  period: { year: number; month: number };
  bills: any[];
  lines?: any[];
  billLines?: any[];
  taxRates?: any[];
}) {
  const { orgGstin, bills, taxRates, period } = input;
  const lines = input.lines || input.billLines || [];
  const orgState = stateCodeFromGstin(orgGstin);

  const linesByBill: Record<string, any[]> = {};
  lines.forEach((l) => {
    (linesByBill[l.bill_id] = linesByBill[l.bill_id] || []).push(l);
  });

  const b2bMap: Record<string, any[]> = {};
  const b2burList: any[] = [];
  const hsnMap: Record<string, any> = {};

  let totalPurchaseValue = 0;

  for (const bill of bills) {
    const vGstin = (bill.vendors?.gstin || "").trim();
    const vState = stateCodeFromGstin(vGstin) || (bill.vendors?.billing_address as any)?.state_code;
    const interstate = !!(orgState && vState && orgState !== vState);
    const pos = vState || orgState || "00";
    const billLinesArr = linesByBill[bill.id] || [];

    totalPurchaseValue += Number(bill.total || 0);

    const itms: any[] = [];
    let invoiceHasTax = false;

    for (let i = 0; i < billLinesArr.length; i++) {
      const ln = billLinesArr[i];
      const q = Number(ln.quantity) || 0;
      const r = Number(ln.rate) || 0;
      let rt = Number(ln.tax_rate || 0);
      
      const txval = q * r; // base taxable value is always qty * rate
      
      let totalTax = Number(ln.tax_amount || 0);
      if (totalTax === 0 && rt > 0 && txval > 0) {
        totalTax = txval * (rt / 100);
      } else if (rt === 0 && totalTax > 0 && txval > 0) {
        // fallback deduction for old bills where tax_rate wasn't saved
        rt = Math.round((totalTax / txval) * 100);
      }

      if (totalTax > 0) invoiceHasTax = true;

      const iamt = interstate ? totalTax : 0;
      const camt = interstate ? 0 : totalTax / 2;
      const samt = interstate ? 0 : totalTax / 2;
      const csamt = 0;

      const hsnCode = (ln.hsn || "").trim() || "9954";
      
      itms.push({
        num: i + 1,
        itm_det: {
          hsn_sc: hsnCode,
          rt,
          txval: r2(txval),
          iamt: r2(iamt),
          camt: r2(camt),
          samt: r2(samt),
          csamt: r2(csamt),
        }
      });

      const hsnKey = `${hsnCode}|${rt}`;
      const h = hsnMap[hsnKey] || {
        hsn_sc: hsnCode,
        desc: ln.description?.split("\n")[0] || hsnCode,
        uqc: (ln.unit || "OTH").toUpperCase().slice(0, 3),
        qty: 0, txval: 0, rt, iamt: 0, camt: 0, samt: 0, csamt: 0,
      };
      h.qty += Number(ln.quantity || 0);
      h.txval += txval;
      h.iamt += iamt;
      h.camt += camt;
      h.samt += samt;
      hsnMap[hsnKey] = h;
    }

    const billObj = {
      inum: bill.vendor_bill_number || bill.bill_number,
      idt: gstrDate(bill.bill_date),
      val: r2(Number(bill.total || 0)),
      pos,
      rchrg: "N",
      inv_typ: "R",
      itms,
    };

    const isGstinValid = vGstin && /^[0-9A-Z]{15}$/.test(vGstin);
    if (isGstinValid) {
      (b2bMap[vGstin] = b2bMap[vGstin] || []).push(billObj);
    } else if (invoiceHasTax) {
      b2burList.push({
        inv: [billObj]
      });
    }
  }

  const b2b = Object.entries(b2bMap).map(([ctin, inv]) => ({ ctin, inv }));
  const hsn = {
    data: Object.values(hsnMap).map((h, i) => ({
      num: i + 1,
      hsn_sc: h.hsn_sc,
      desc: h.desc,
      uqc: h.uqc,
      qty: r2(h.qty),
      rt: h.rt,
      txval: r2(h.txval),
      iamt: r2(h.iamt),
      camt: r2(h.camt),
      samt: r2(h.samt),
      csamt: r2(h.csamt),
    })),
  };

  return {
    gstin: orgGstin,
    fp: gstrPeriod(period.year, period.month),
    gt: r2(totalPurchaseValue),
    cur_gt: r2(totalPurchaseValue),
    b2b,
    b2bur: b2burList,
    hsn,
  };
}

export function calculateTaxBreakdown(
  lines: { tax_id?: string | null, tax_rate?: number | null, tax_amount: number, amount?: number }[],
  taxRates: { id: string, rate: number }[],
  isInterstate: boolean
) {
  const taxBreakdownMap: Record<string, { id: string, name: string, rate: number, amount: number }> = {};

  lines.forEach(line => {
    if (line.tax_amount > 0) {
      let rate = 0;
      if (line.tax_rate) {
        rate = Number(line.tax_rate);
      } else if (line.tax_id) {
        const tax = taxRates.find((t: any) => t.id === line.tax_id);
        if (tax) rate = Number(tax.rate);
      } else if (line.amount) {
        const taxableAmount = line.amount - line.tax_amount;
        if (taxableAmount > 0) {
          rate = Math.round((line.tax_amount / taxableAmount) * 100);
        }
      }
      
      if (rate > 0) {
        if (isInterstate) {
          const key = `IGST_${rate}`;
          if (!taxBreakdownMap[key]) taxBreakdownMap[key] = { id: key, name: `IGST @ ${rate}%`, rate, amount: 0 };
          taxBreakdownMap[key].amount += line.tax_amount;
        } else {
          const cgstKey = `CGST_${rate/2}`;
          const sgstKey = `SGST_${rate/2}`;
          if (!taxBreakdownMap[cgstKey]) taxBreakdownMap[cgstKey] = { id: cgstKey, name: `CGST @ ${rate/2}%`, rate: rate/2, amount: 0 };
          if (!taxBreakdownMap[sgstKey]) taxBreakdownMap[sgstKey] = { id: sgstKey, name: `SGST @ ${rate/2}%`, rate: rate/2, amount: 0 };
          taxBreakdownMap[cgstKey].amount += line.tax_amount / 2;
          taxBreakdownMap[sgstKey].amount += line.tax_amount / 2;
        }
      }
    }
  });

  return Object.values(taxBreakdownMap);
}
