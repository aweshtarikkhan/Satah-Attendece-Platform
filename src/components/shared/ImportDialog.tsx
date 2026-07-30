import { useState, useCallback, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import ExcelJS from "exceljs";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: ImportField[];
  entityName: string;
  onImport: (rows: Record<string, any>[]) => Promise<{ success: number; errors: number }>;
}

type Step = "upload" | "map" | "preview" | "result";

export function ImportDialog({ open, onOpenChange, fields, entityName, onImport }: ImportDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);

  const reset = () => {
    setStep("upload");
    setRawData([]);
    setHeaders([]);
    setMapping({});
    setResult(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const parseFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          const rows = Array.isArray(json) ? json : [json];
          if (!rows.length) { toast({ title: "Empty file", variant: "destructive" }); return; }
          const keys = Object.keys(rows[0]);
          setHeaders(keys);
          setRawData(rows);
          autoMap(keys);
          setStep("map");
        } catch { toast({ title: "Invalid JSON", variant: "destructive" }); }
      };
      reader.readAsText(file);
    } else if (ext === "csv" || ext === "tsv") {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => {
          if (!res.data.length) { toast({ title: "Empty file", variant: "destructive" }); return; }
          const keys = res.meta.fields || Object.keys(res.data[0] as any);
          setHeaders(keys);
          setRawData(res.data as any[]);
          autoMap(keys);
          setStep("map");
        },
        error: () => toast({ title: "Failed to parse CSV", variant: "destructive" }),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(e.target?.result as ArrayBuffer);
          const ws = wb.worksheets[0];
          if (!ws || ws.rowCount < 2) { toast({ title: "Empty spreadsheet", variant: "destructive" }); return; }
          const headerRow = ws.getRow(1).values as any[];
          const keys: string[] = [];
          for (let i = 1; i < headerRow.length; i++) {
            const v = headerRow[i];
            keys.push(v == null ? `Column ${i}` : String(v));
          }
          const rows: Record<string, any>[] = [];
          for (let r = 2; r <= ws.rowCount; r++) {
            const rowVals = ws.getRow(r).values as any[];
            const obj: Record<string, any> = {};
            let hasValue = false;
            keys.forEach((k, idx) => {
              const cell = rowVals[idx + 1];
              const val = cell && typeof cell === "object" && "text" in cell ? (cell as any).text : cell;
              if (val !== undefined && val !== null && val !== "") hasValue = true;
              obj[k] = val ?? "";
            });
            if (hasValue) rows.push(obj);
          }
          if (!rows.length) { toast({ title: "Empty spreadsheet", variant: "destructive" }); return; }
          setHeaders(keys);
          setRawData(rows);
          autoMap(keys);
          setStep("map");
        } catch {
          toast({ title: "Failed to parse spreadsheet", variant: "destructive" });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast({ title: "Unsupported format", description: "Use CSV, Excel (.xlsx), or JSON", variant: "destructive" });
    }
  }, []);

  const autoMap = (fileHeaders: string[]) => {
    const m: Record<string, string> = {};
    fields.forEach((f) => {
      const match = fileHeaders.find((h) => {
        const norm = (s: string) => s.toLowerCase().replace(/[_\-\s]/g, "");
        return norm(h) === norm(f.key) || norm(h) === norm(f.label);
      });
      if (match) m[f.key] = match;
    });
    setMapping(m);
  };

  const mappedRows = rawData.map((row) => {
    const mapped: Record<string, any> = {};
    fields.forEach((f) => {
      const src = mapping[f.key];
      if (src) mapped[f.key] = row[src];
    });
    return mapped;
  });

  const requiredMissing = fields.filter((f) => f.required && !mapping[f.key]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await onImport(mappedRows.filter((r) => Object.values(r).some(Boolean)));
      setResult(res);
      setStep("result");
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    }
    setImporting(false);
  };

  const downloadSample = () => {
    const csvHeader = fields.map(f => f.label).join(",");
    const csvRow = fields.map(f => `Sample ${f.label}`).join(",");
    const csvContent = `${csvHeader}\n${csvRow}`;
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${entityName.toLowerCase().replace(/\s+/g, "_")}_sample.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import {entityName}</DialogTitle>
          <DialogDescription>
            Upload a CSV, Excel, or JSON file to import {entityName.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div>
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.json,.xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
              />
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Drop your file here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">Supports CSV, Excel (.xlsx), and JSON</p>
            </div>
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={downloadSample}>
                <Download className="mr-2 h-4 w-4" /> Download Sample CSV
              </Button>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{rawData.length} rows found</span>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Map your columns to fields:</p>
              {fields.map((f) => (
                <div key={f.key} className="grid grid-cols-2 gap-3 items-center">
                  <Label className="text-sm">
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Select value={mapping[f.key] || "_skip"} onValueChange={(v) => setMapping((prev) => ({ ...prev, [f.key]: v === "_skip" ? "" : v }))}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Skip" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_skip">— Skip —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {requiredMissing.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Missing required: {requiredMissing.map((f) => f.label).join(", ")}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={() => setStep("preview")} disabled={requiredMissing.length > 0}>Preview</Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Preview of first 5 rows:</p>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {fields.filter((f) => mapping[f.key]).map((f) => (
                      <TableHead key={f.key} className="text-xs">{f.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedRows.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {fields.filter((f) => mapping[f.key]).map((f) => (
                        <TableCell key={f.key} className="text-xs">{String(row[f.key] ?? "")}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-sm">Total rows to import: <strong>{mappedRows.filter((r) => Object.values(r).some(Boolean)).length}</strong></p>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importing..." : `Import ${entityName}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4 text-center py-6">
            <CheckCircle2 className="h-12 w-12 mx-auto text-success" />
            <div>
              <p className="text-lg font-semibold">Import Complete</p>
              <div className="flex items-center justify-center gap-3 mt-2">
                <Badge variant="default" className="bg-success/15 text-success">{result.success} imported</Badge>
                {result.errors > 0 && <Badge variant="destructive">{result.errors} failed</Badge>}
              </div>
            </div>
            <DialogFooter className="justify-center">
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
