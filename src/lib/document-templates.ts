export const DOCUMENT_TEMPLATES = [
  {
    id: "classic",
    name: "Classic",
    description: "Traditional business invoice with clean layout",
    preview: "bg-background border-border",
    features: ["Company logo", "Line items table", "Notes section"],
    recommendedPaperSize: "a4",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Contemporary design with accent colors and bold typography",
    preview: "bg-primary/5 border-primary/20",
    features: ["Colored header", "Rounded elements", "Status badges"],
    recommendedPaperSize: "a4",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean and simple with maximum whitespace",
    preview: "bg-muted/30 border-border",
    features: ["Minimalist layout", "Subtle borders", "Compact totals"],
    recommendedPaperSize: "a4",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Corporate-grade template with detailed sections",
    preview: "bg-accent/10 border-accent/30",
    features: ["Dual address blocks", "Payment details", "Tax breakdown"],
    recommendedPaperSize: "a4",
  },
  {
    id: "asperiores",
    name: "Asperiores",
    description: "Bold executive layout with striking contrasts",
    preview: "bg-destructive/5 border-destructive/20",
    features: ["Bold headers", "Contrast sections", "Executive summary"],
    recommendedPaperSize: "letter",
  },
  {
    id: "magnam",
    name: "Magnam",
    description: "Elegant template with refined spacing and serif touches",
    preview: "bg-success/5 border-success/20",
    features: ["Serif accents", "Elegant borders", "Refined totals"],
    recommendedPaperSize: "a4",
  },
  {
    id: "quisquam",
    name: "Quisquam",
    description: "Compact data-dense layout for detailed invoices",
    preview: "bg-warning/5 border-warning/20",
    features: ["Dense tables", "Compact layout", "Multi-column footer"],
    recommendedPaperSize: "a5",
  },
  {
    id: "nobis",
    name: "Nobis",
    description: "Creative modern template with asymmetric design",
    preview: "bg-secondary/50 border-secondary",
    features: ["Asymmetric layout", "Creative header", "Accent sidebar"],
    recommendedPaperSize: "a4",
  },
  {
    id: "compact",
    name: "Compact Bill",
    description: "Traditional compact bill format with centered header and numbered items",
    preview: "bg-background border-primary/30",
    features: ["Centered header", "Numbered items", "Balance due highlight"],
    recommendedPaperSize: "a6",
  },
  {
    id: "alpha_blue",
    name: "Alpha Blue",
    description: "Bold blue header with framed customer block and yellow invoice tag",
    preview: "bg-background border-primary/40",
    features: ["Centered brand", "Framed customer box", "Yellow tag", "Day-Month-Year"],
    recommendedPaperSize: "a6",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Crisp black & white classic with bold section bars — distraction-free",
    preview: "bg-background border-foreground/40",
    features: ["B&W formal", "Section bars", "Notes + totals split"],
    recommendedPaperSize: "a6",
  },
  {
    id: "amanda_cream",
    name: "Cream Receipt",
    description: "Warm cream background with bold black 'RECEIPT' tag and elegant footer",
    preview: "bg-warning/5 border-warning/30",
    features: ["Cream tone", "Receipt tag", "Bold footer band"],
    recommendedPaperSize: "a6",
  },
  {
    id: "redblue_modern",
    name: "Red & Navy",
    description: "Modern angled header with red & navy accent bands per row",
    preview: "bg-destructive/5 border-destructive/30",
    features: ["Angled header", "Accent bars", "Payment block"],
    recommendedPaperSize: "a6",
  },
  {
    id: "pos",
    name: "POS Receipt (80mm)",
    description: "Thermal printer / cash register style receipt for 80mm roll paper",
    preview: "bg-background border-foreground/40",
    features: ["80mm thermal", "Monospace font", "Compact rows", "Tear-off receipt"],
    recommendedPaperSize: "pos80",
  },
] as const;

export const PAPER_SIZES = [
  { id: "a4", name: "A4", dimensions: "210 × 297 mm" },
  { id: "letter", name: "Letter", dimensions: "8.5 × 11 in" },
  { id: "legal", name: "Legal", dimensions: "8.5 × 14 in" },
  { id: "a5", name: "A5", dimensions: "148 × 210 mm" },
  { id: "a6", name: "A6", dimensions: "105 × 148 mm" },
  { id: "pos80", name: "POS 80mm", dimensions: "80 × auto mm" },
] as const;

export function getDocumentPreviewClass(templateStyle?: string, paperSize?: string) {
  const styleClass = {
    classic: "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
    modern: "rounded-[1.5rem] border border-primary/20 bg-card text-card-foreground shadow-sm",
    minimal: "border border-border/70 bg-background text-foreground",
    professional: "rounded-lg border border-accent bg-card text-card-foreground shadow-md",
    asperiores: "rounded-xl border-2 border-destructive/30 bg-card text-card-foreground shadow-lg",
    magnam: "rounded-2xl border border-success/30 bg-card text-card-foreground shadow-sm",
    quisquam: "rounded-md border border-warning/30 bg-card text-card-foreground shadow-sm",
    nobis: "rounded-xl border-l-4 border-secondary bg-card text-card-foreground shadow-md",
    compact: "rounded-lg border border-foreground/20 bg-background text-foreground shadow-sm",
    alpha_blue: "rounded-lg border-2 border-primary bg-background text-foreground shadow-sm",
    monochrome: "rounded-md border-2 border-foreground bg-background text-foreground shadow-sm",
    amanda_cream: "rounded-lg border border-foreground/30 shadow-sm",
    redblue_modern: "rounded-lg border border-destructive/30 bg-background text-foreground shadow-sm",
    pos: "border border-foreground/30 bg-background text-foreground shadow-sm",
  }[templateStyle || "classic"];

  const sizeClass = {
    a4: "max-w-[210mm]",
    letter: "max-w-[8.5in]",
    legal: "max-w-[8.5in] min-h-[14in]",
    a5: "max-w-[148mm]",
    a6: "max-w-[105mm]",
    pos80: "max-w-[80mm]",
  }[paperSize || "a4"];

  const isCompactish = templateStyle === "compact" || templateStyle === "pos";
  return `invoice-printable ${isCompactish ? "" : "mx-auto"} w-full ${styleClass || "rounded-xl border border-border bg-card text-card-foreground shadow-sm"} ${isCompactish ? "" : (sizeClass || "max-w-[210mm]")} print:max-w-none print:shadow-none print:border-0 print:rounded-none`;
}

export function getPaperSizeLabel(paperSize?: string) {
  return PAPER_SIZES.find((size) => size.id === paperSize)?.name || "A4";
}

/** Returns CSS class to add to <html> or a <style> tag for @page sizing */
export function getPrintPageCSS(paperSize?: string): string {
  const sizes: Record<string, string> = {
    a4: "210mm 297mm",
    letter: "8.5in 11in",
    legal: "8.5in 14in",
    a5: "148mm 210mm",
    a6: "105mm 148mm",
    pos80: "80mm auto",
  };
  const size = sizes[paperSize || "a4"] || sizes.a4;

  const fontScale: Record<string, string> = {
    a4: "11px",
    letter: "11px",
    legal: "11px",
    a5: "9px",
    a6: "7px",
    pos80: "11px",
  };
  const baseFontSize = fontScale[paperSize || "a4"] || "11px";
  const pageMargin = paperSize === "pos80" ? "2mm" : "8mm";
  const pagePadding = paperSize === "pos80" ? "0" : "12px";

  return `
@media print {
  @page { size: ${size}; margin: ${pageMargin}; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body * { visibility: hidden; }
  .invoice-printable, .invoice-printable * { visibility: visible; }
  .invoice-printable {
    position: absolute; left: 0; top: 0;
    width: 100% !important; max-width: none !important;
    margin: 0 !important; padding: ${pagePadding} !important;
    font-size: ${baseFontSize} !important;
    box-shadow: none !important; border: none !important; border-radius: 0 !important;
    color: #000 !important; background: #fff !important;
  }
  .invoice-printable table { font-size: inherit !important; border-collapse: collapse; width: 100%; }
  .invoice-printable th, .invoice-printable td { padding: 3px 6px !important; font-size: inherit !important; }
  .invoice-printable thead { display: table-header-group; }
  .invoice-printable tr, .invoice-printable td, .invoice-printable th { page-break-inside: avoid !important; break-inside: avoid !important; }
  .invoice-printable h1, .invoice-printable h2, .invoice-printable h3 { font-size: 1.1em !important; }
  .no-print, header, nav, aside, [data-sidebar], .sidebar-trigger { display: none !important; }
}`;
}