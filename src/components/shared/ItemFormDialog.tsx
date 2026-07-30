import { useEffect, useState, useMemo } from "react";
import JsBarcode from "jsbarcode";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { COMMON_UNITS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Package, Trash2, FileText, Tag, Users, Database, X, Settings, Info, Ruler, Plus } from "lucide-react";

const INDIAN_GST_SLABS = [
  { id: 'exempt', name: 'None', rate: 0 },
  { id: 'gst0', name: 'Exempted (0%)', rate: 0 },
  { id: 'gst5', name: 'GST 5%', rate: 5 },
  { id: 'gst12', name: 'GST 12%', rate: 12 },
  { id: 'gst18', name: 'GST 18%', rate: 18 },
  { id: 'gst28', name: 'GST 28%', rate: 28 },
];

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: any | null;
  onItemSaved?: (item?: any) => void;
  categories?: string[];
  defaultType?: "product" | "service";
}

export function ItemFormDialog({ open, onOpenChange, editItem, onItemSaved, categories = [], defaultType = "product" }: ItemFormDialogProps) {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("basic");
  const [loading, setLoading] = useState(false);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [partyPrices, setPartyPrices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<any[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  
  const defaultForm = {
    name: "", description: "", sku: "", type: defaultType,
    unit_price: 0, sales_price_type: "with_tax",
    purchase_price: 0, purchase_price_type: "with_tax",
    discount: 0,
    unit: "pcs", tax_id: null as string | null,
    category: "", stock_quantity: 0, hsn_code: "",
    show_online: false,
    as_of_date: new Date().toISOString().split('T')[0],
    sub_unit: "", sub_unit_conversion_rate: 1,
    low_stock_warning: false
  };
  
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (open && org?.id) {
      fetchDependencies();
      if (editItem) {
        setForm({
          ...defaultForm,
          name: editItem.name || "", description: editItem.description || "", sku: editItem.sku || "",
          type: editItem.type || defaultType, unit_price: Number(editItem.unit_price) || 0, unit: editItem.unit || "pcs",
          tax_id: editItem.tax_id, category: editItem.category || "", stock_quantity: Number(editItem.stock_quantity || 0),
          hsn_code: editItem.hsn_code || "",
          purchase_price: Number(editItem.purchase_price) || 0,
          sales_price_type: editItem.sales_price_type || "with_tax",
          purchase_price_type: editItem.purchase_price_type || "with_tax",
          discount: Number(editItem.discount) || 0,
          show_online: editItem.show_online || false,
          sub_unit: editItem.sub_unit || "",
          sub_unit_conversion_rate: editItem.sub_unit_conversion_rate || 1,
        });
        fetchItemDetails(editItem.id);
      } else {
        setForm(defaultForm);
        setPartyPrices([]);
        setCustomFieldValues({});
        setActiveTab("basic");
      }
    }
  }, [open, org?.id, editItem]);

  const fetchDependencies = async () => {
    if (!org?.id) return;
    const [tRes, cRes, vRes, cfRes] = await Promise.all([
      supabase.from("tax_rates").select("*").eq("org_id", org.id),
      supabase.from("clients").select("id, name").eq("org_id", org.id),
      supabase.from("vendors").select("id, name").eq("org_id", org.id),
      supabase.from("custom_field_definitions").select("*").eq("org_id", org.id).eq("entity_type", "item").order("sort_order")
    ]);
    if (tRes.data) setTaxRates(tRes.data);
    if (cRes.data) setClients(cRes.data);
    if (vRes.data) setVendors(vRes.data);
    if (cfRes.data) setCustomFieldDefs(cfRes.data);
  };

  const fetchItemDetails = async (itemId: string) => {
    const [partyRes, cfRes] = await Promise.all([
      supabase.from("item_party_prices").select("*").eq("item_id", itemId),
      supabase.from("custom_field_values").select("*").eq("entity_id", itemId)
    ]);
    setPartyPrices(partyRes.data || []);
    
    const cfMap: Record<string, any> = {};
    cfRes.data?.forEach(v => cfMap[v.field_id] = v.field_value);
    setCustomFieldValues(cfMap);
  };

  const handleSave = async (saveAndNew = false) => {
    if (!form.name.trim()) {
      toast({ title: "Item Name required", variant: "destructive" });
      setActiveTab("basic");
      return;
    }

    setLoading(true);

    let finalTaxId = form.tax_id;
    if (form.tax_id && INDIAN_GST_SLABS.some(s => s.id === form.tax_id)) {
      const slab = INDIAN_GST_SLABS.find(s => s.id === form.tax_id)!;
      const existing = taxRates.find(t => t.rate === slab.rate && t.name.toLowerCase().includes('gst'));
      if (existing) {
        finalTaxId = existing.id;
      } else {
        const { data: newTax } = await supabase.from('tax_rates').insert({
          org_id: org!.id,
          name: slab.name,
          rate: slab.rate,
        }).select().single();
        if (newTax) {
          finalTaxId = newTax.id;
          setTaxRates(prev => [...prev, newTax]);
        }
      }
    }

    const payload = {
      org_id: org!.id,
      name: form.name,
      description: form.description || null,
      sku: form.sku || null,
      type: form.type,
      unit_price: form.unit_price,
      unit: form.unit || null,
      tax_id: finalTaxId,
      category: form.category || null,
      stock_quantity: form.stock_quantity,
      hsn_code: form.hsn_code || null,
      purchase_price: form.purchase_price,
      sales_price_type: form.sales_price_type,
      purchase_price_type: form.purchase_price_type,
      sub_unit: form.sub_unit || null,
      sub_unit_conversion_rate: form.sub_unit_conversion_rate || null,
      discount: form.discount,
      show_online: form.show_online,
      is_active: true
    };

    let savedItem = null;

    if (editItem) {
      const { data, error } = await supabase.from("items").update(payload).eq("id", editItem.id).select().single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setLoading(false); return; }
      savedItem = data;
      toast({ title: "Item updated" });
    } else {
      const { data, error } = await supabase.from("items").insert(payload).select().single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setLoading(false); return; }
      savedItem = data;
      toast({ title: "Item created" });
    }
    
    if (savedItem) {
      await supabase.from("item_party_prices").delete().eq("item_id", savedItem.id);
      if (partyPrices.length > 0) {
        await supabase.from("item_party_prices").insert(
          partyPrices.map(p => ({
            org_id: org!.id,
            item_id: savedItem.id,
            party_type: p.party_type,
            party_id: p.party_id,
            price: p.price
          }))
        );
      }

      await supabase.from("custom_field_values").delete().eq("entity_id", savedItem.id);
      const cfEntries = Object.entries(customFieldValues)
        .filter(([_, val]) => val !== undefined && val !== "")
        .map(([field_id, val]) => ({
          field_id,
          entity_id: savedItem.id,
          field_value: val,
        }));
      if (cfEntries.length > 0) {
        await supabase.from("custom_field_values").insert(cfEntries);
      }
    }
    
    setLoading(false);
    
    if (onItemSaved) {
      onItemSaved(savedItem);
    }

    if (saveAndNew) {
      setForm(defaultForm);
      setPartyPrices([]);
      setCustomFieldValues({});
      setActiveTab("basic");
    } else {
      onOpenChange(false);
    }
  };

  const handleGenerateBarcode = () => {
    let sku = form.sku;
    if (!sku) {
      sku = "ITM" + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      setForm({ ...form, sku });
    }
    
    setTimeout(() => {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, sku, { format: "CODE128", displayValue: true, margin: 10, height: 50 });
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `barcode-${sku}.png`;
      link.href = url;
      link.click();
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden bg-slate-50 [&>button]:hidden">
        <div className="flex flex-col h-[85vh] max-h-[750px]">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-white shadow-sm z-10">
            <DialogTitle className="text-xl font-semibold text-slate-800">{editItem ? "Edit Item" : "Create New Item"}</DialogTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex flex-1 overflow-hidden">
            <div className="w-[260px] bg-white border-r flex flex-col py-4">
              <div className="px-3 space-y-1">
                <button
                  onClick={() => setActiveTab("basic")}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "basic" ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <span className="flex items-center gap-3"><FileText className="h-4 w-4" /> Basic Details</span>
                  <span className="text-destructive">*</span>
                </button>
                
                <div className="px-4 pt-6 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Advance Details</div>
                
                <button
                  onClick={() => setActiveTab("stock")}
                  className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "stock" ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <Package className="h-4 w-4 mr-3" /> Stock Details
                </button>
                
                <button
                  onClick={() => setActiveTab("pricing")}
                  className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "pricing" ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <Tag className="h-4 w-4 mr-3" /> Pricing Details
                </button>
                
                <button
                  onClick={() => setActiveTab("party")}
                  className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "party" ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <Users className="h-4 w-4 mr-3" /> Party Wise Prices
                </button>
                
                <button
                  onClick={() => setActiveTab("custom")}
                  className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "custom" ? "bg-indigo-50/70 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <Database className="h-4 w-4 mr-3" /> Custom Fields
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              
              {activeTab === "basic" && (
                <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-slate-600">Item Type <span className="text-destructive">*</span></Label>
                      <RadioGroup 
                        value={form.type} 
                        onValueChange={(v) => setForm({ ...form, type: v as any })}
                        className="flex gap-4"
                      >
                        <div className={`flex items-center justify-center space-x-2 border rounded-lg px-4 py-2.5 flex-1 cursor-pointer transition-colors ${form.type === 'product' ? 'border-indigo-500 bg-indigo-50/30' : 'bg-white'}`}>
                          <RadioGroupItem value="product" id="r1" className="text-indigo-600 border-indigo-600" />
                          <Package className={`h-4 w-4 ${form.type === 'product' ? 'text-indigo-600' : 'text-slate-400'}`} />
                          <Label htmlFor="r1" className="cursor-pointer font-medium">Product</Label>
                        </div>
                        <div className={`flex items-center justify-center space-x-2 border rounded-lg px-4 py-2.5 flex-1 cursor-pointer transition-colors ${form.type === 'service' ? 'border-indigo-500 bg-indigo-50/30' : 'bg-white'}`}>
                          <RadioGroupItem value="service" id="r2" className="text-indigo-600 border-indigo-600" />
                          <Settings className={`h-4 w-4 ${form.type === 'service' ? 'text-indigo-600' : 'text-slate-400'}`} />
                          <Label htmlFor="r2" className="cursor-pointer font-medium">Service</Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-slate-600">Category</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Search Categories" /></SelectTrigger>
                        <SelectContent>
                          {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          <SelectItem value="electronics">Electronics</SelectItem>
                          <SelectItem value="services">Services</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 items-end">
                    <div className="space-y-3">
                      <Label className="text-slate-600 flex items-center gap-1">Item Name <span className="text-destructive">*</span> <Info className="h-3.5 w-3.5 text-slate-400" /></Label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                          value={form.name} 
                          onChange={(e) => setForm({ ...form, name: e.target.value })} 
                          placeholder="ex: Maggie 20gm" 
                          className="pl-9 h-11 border-indigo-200 focus-visible:ring-indigo-500 bg-white" 
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-xl bg-white h-11">
                      <Label className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-1.5" htmlFor="online">
                        Show Item in Online Store <Info className="h-3.5 w-3.5 text-slate-400" />
                      </Label>
                      <Switch id="online" checked={form.show_online} onCheckedChange={(c) => setForm({...form, show_online: c})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-slate-600">Sales Price</Label>
                      <div className="flex relative shadow-sm rounded-lg">
                        <span className="absolute left-3 top-3 text-slate-400">₹</span>
                        <Input 
                          type="number" 
                          value={form.unit_price || ""} 
                          onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} 
                          className="pl-8 h-11 rounded-r-none border-r-0 bg-white focus-visible:ring-indigo-500 z-10" 
                          placeholder="ex: 200" 
                        />
                        <Select value={form.sales_price_type} onValueChange={(v) => setForm({...form, sales_price_type: v})}>
                          <SelectTrigger className="w-[130px] h-11 rounded-l-none bg-slate-50 border-l-0 text-slate-600 focus:ring-0 focus:ring-offset-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="with_tax">With Tax</SelectItem>
                            <SelectItem value="without_tax">Without Tax</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {org?.sub_unit_enabled && form.sub_unit && form.sub_unit_conversion_rate > 0 && form.unit_price > 0 && (
                        <div className="text-sm text-slate-400 font-medium opacity-50 mt-1">
                          1 {form.sub_unit} = ₹{(form.unit_price / form.sub_unit_conversion_rate).toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Label className="text-slate-600">GST Tax Rate(%)</Label>
                      <Select value={form.tax_id || "none"} onValueChange={(v) => setForm({ ...form, tax_id: v === "none" ? null : v })}>
                        <SelectTrigger className="h-11 bg-white">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {taxRates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name} ({t.rate}%)</SelectItem>
                          ))}
                          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase mt-2">Standard Rates</div>
                          {INDIAN_GST_SLABS.filter(s => s.id !== 'exempt').map(slab => (
                            <SelectItem key={slab.id} value={slab.id}>{slab.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-slate-600">Measuring Unit</Label>
                      <div className="relative">
                        <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                        <Select value={form.unit || "pcs"} onValueChange={(v) => setForm({ ...form, unit: v })}>
                          <SelectTrigger className="pl-9 h-11 bg-white"><SelectValue placeholder="Pieces(PCS)" /></SelectTrigger>
                          <SelectContent>
                            {COMMON_UNITS.map(u => (
                              <SelectItem key={u} value={u}>{u.toUpperCase()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-slate-600">Opening Stock</Label>
                      <div className="relative">
                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                        <Input 
                          type="number" 
                          value={form.stock_quantity || ""} 
                          onChange={(e) => setForm({ ...form, stock_quantity: parseFloat(e.target.value) || 0 })} 
                          className="pl-9 h-11 bg-white pr-16" 
                          placeholder="ex: 150" 
                        />
                        <div className="absolute right-0 top-0 h-full flex items-center justify-center px-4 border-l text-slate-500 text-sm font-medium bg-slate-50 rounded-r-md min-w-16">
                          {form.unit ? form.unit.toUpperCase() : 'PCS'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "stock" && (
                <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-slate-600">Item Code</Label>
                      <div className="flex rounded-lg shadow-sm">
                        <Input 
                          value={form.sku} 
                          onChange={(e) => setForm({ ...form, sku: e.target.value })} 
                          className="h-11 rounded-r-none bg-white" 
                          placeholder="ex: ITM12549" 
                        />
                        <Button variant="secondary" className="h-11 rounded-l-none bg-blue-50 text-blue-600 hover:bg-blue-100 border border-l-0" onClick={handleGenerateBarcode}>
                          Generate Barcode
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-slate-600">HSN code</Label>
                      <Input 
                        value={form.hsn_code} 
                        onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} 
                        className="h-11 bg-white" 
                        placeholder="ex: 4010" 
                      />
                      <button className="text-blue-500 text-sm hover:underline">Find HSN Code</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-slate-600">Measuring Unit</Label>
                      <Select value={form.unit || "pcs"} onValueChange={(v) => setForm({ ...form, unit: v })}>
                        <SelectTrigger className="h-11 bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COMMON_UNITS.map(u => (
                            <SelectItem key={u} value={u}>{u.toUpperCase()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="pt-2">
                        <button className="text-blue-500 text-sm hover:underline font-medium">+ Alternative Unit</button>
                      </div>
                    </div>
                    {org?.sub_unit_enabled && (
                      <div className="space-y-3">
                        <Label className="text-slate-600">Sub Unit</Label>
                        <div className="flex shadow-sm rounded-lg">
                          <Input
                            value={form.sub_unit || ""}
                            onChange={(e) => setForm({ ...form, sub_unit: e.target.value })}
                            className="h-11 rounded-r-none bg-white min-w-[80px]"
                            placeholder="ex: Pack"
                          />
                          <div className="flex items-center bg-slate-50 border-y px-2 text-slate-500 text-sm whitespace-nowrap">
                            =
                          </div>
                          <Input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={form.sub_unit_conversion_rate || ""}
                            onChange={(e) => setForm({ ...form, sub_unit_conversion_rate: parseFloat(e.target.value) || 1 })}
                            className="h-11 rounded-none border-x-0 bg-white w-[70px] px-2 text-center"
                            placeholder="Qty"
                          />
                          <div className="flex items-center bg-slate-50 border rounded-r-lg px-2 text-slate-500 text-sm whitespace-nowrap">
                            / {form.unit || 'pcs'}
                          </div>
                        </div>
                        <p className="text-xs text-slate-400">e.g. 1 {form.unit || 'Box'} = 10 Packs</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-slate-600">Opening Stock</Label>
                      <div className="relative">
                        <Input 
                          type="number" 
                          value={form.stock_quantity || ""} 
                          onChange={(e) => setForm({ ...form, stock_quantity: parseFloat(e.target.value) || 0 })} 
                          className="h-11 bg-white pr-12" 
                          placeholder="ex: 150" 
                        />
                        <span className="absolute right-3 top-3 text-slate-400 text-sm font-medium">{form.unit ? form.unit.toUpperCase() : 'PCS'}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-slate-600">As of Date</Label>
                      <Input type="date" className="h-11 bg-white" value={form.as_of_date} onChange={(e) => setForm({...form, as_of_date: e.target.value})} />
                    </div>
                  </div>

                  <div>
                    <button className="text-blue-500 text-sm hover:underline font-medium">+ Enable Low stock quantity warning</button>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-slate-600">Description</Label>
                    <Textarea 
                      value={form.description} 
                      onChange={(e) => setForm({ ...form, description: e.target.value })} 
                      className="min-h-[100px] bg-white resize-none" 
                      placeholder="Enter Description"
                    />
                  </div>
                </div>
              )}

              {activeTab === "pricing" && (
                <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-slate-600">Sales Price</Label>
                      <div className="flex relative shadow-sm rounded-lg">
                        <span className="absolute left-3 top-3 text-slate-400">₹</span>
                        <Input 
                          type="number" 
                          value={form.unit_price || ""} 
                          onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} 
                          className="pl-8 h-11 rounded-r-none border-r-0 bg-white" 
                          placeholder="ex: 200" 
                        />
                        <Select value={form.sales_price_type} onValueChange={(v) => setForm({...form, sales_price_type: v})}>
                          <SelectTrigger className="w-[130px] h-11 rounded-l-none bg-slate-50 border-l-0 text-slate-600 focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="with_tax">With Tax</SelectItem>
                            <SelectItem value="without_tax">Without Tax</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {org?.sub_unit_enabled && form.sub_unit && form.sub_unit_conversion_rate > 0 && form.unit_price > 0 && (
                        <div className="text-sm text-slate-400 font-medium opacity-50 mt-1">
                          1 {form.sub_unit} = ₹{(form.unit_price / form.sub_unit_conversion_rate).toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Label className="text-slate-600">Purchase Price</Label>
                      <div className="flex relative shadow-sm rounded-lg">
                        <span className="absolute left-3 top-3 text-slate-400">₹</span>
                        <Input 
                          type="number" 
                          value={form.purchase_price || ""} 
                          onChange={(e) => setForm({ ...form, purchase_price: parseFloat(e.target.value) || 0 })} 
                          className="pl-8 h-11 rounded-r-none border-r-0 bg-white" 
                          placeholder="ex: 200" 
                        />
                        <Select value={form.purchase_price_type} onValueChange={(v) => setForm({...form, purchase_price_type: v})}>
                          <SelectTrigger className="w-[130px] h-11 rounded-l-none bg-slate-50 border-l-0 text-slate-600 focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="with_tax">With Tax</SelectItem>
                            <SelectItem value="without_tax">Without Tax</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-slate-600">GST Tax Rate(%)</Label>
                      <Select value={form.tax_id || "none"} onValueChange={(v) => setForm({ ...form, tax_id: v === "none" ? null : v })}>
                        <SelectTrigger className="h-11 bg-white">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {taxRates
                            .filter((t) => !t.name.toUpperCase().includes("CGST") && !t.name.toUpperCase().includes("SGST"))
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name.replace(/IGST/i, "GST")} ({t.rate}%)</SelectItem>
                            ))}
                          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase mt-2">Standard Rates</div>
                          {INDIAN_GST_SLABS.filter(s => s.id !== 'exempt').map(slab => (
                            <SelectItem key={slab.id} value={slab.id}>{slab.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-slate-600">Discount on Sales Price <span className="text-slate-400 ml-1">ⓘ</span></Label>
                      <div className="relative">
                        <Input 
                          type="number" 
                          value={form.discount || ""} 
                          onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })} 
                          className="h-11 bg-white pr-12" 
                          placeholder="ex: 12" 
                        />
                        <span className="absolute right-3 top-3 text-slate-400 text-sm font-medium">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === "party" && (
                <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-slate-800">Special Pricing</h3>
                    <Button size="sm" onClick={() => setPartyPrices([...partyPrices, { party_type: 'client', party_id: '', price: 0 }])}>
                      <Plus className="h-4 w-4 mr-2" /> Add Price
                    </Button>
                  </div>
                  {partyPrices.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 border-2 border-dashed rounded-xl bg-slate-50">
                      No special prices configured. Add special prices for specific clients or vendors.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {partyPrices.map((p, idx) => (
                        <div key={idx} className="flex gap-4 items-end bg-white p-4 rounded-xl border shadow-sm">
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={p.party_type} onValueChange={v => { const n = [...partyPrices]; n[idx].party_type = v; n[idx].party_id = ''; setPartyPrices(n); }}>
                              <SelectTrigger className="w-[120px] bg-white"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="client">Client</SelectItem>
                                <SelectItem value="vendor">Vendor</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 flex-1">
                            <Label>{p.party_type === 'client' ? 'Client' : 'Vendor'}</Label>
                            <Select value={p.party_id} onValueChange={v => { const n = [...partyPrices]; n[idx].party_id = v; setPartyPrices(n); }}>
                              <SelectTrigger className="bg-white"><SelectValue placeholder={`Select ${p.party_type}`} /></SelectTrigger>
                              <SelectContent>
                                {(p.party_type === 'client' ? clients : vendors).map(party => (
                                  <SelectItem key={party.id} value={party.id}>{party.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 w-[150px]">
                            <Label>Price (₹)</Label>
                            <Input 
                              type="number" 
                              value={p.price || ""} 
                              onChange={e => { const n = [...partyPrices]; n[idx].price = parseFloat(e.target.value) || 0; setPartyPrices(n); }} 
                              className="bg-white" 
                            />
                          </div>
                          <Button variant="ghost" className="text-destructive mb-0.5" onClick={() => { const n = [...partyPrices]; n.splice(idx, 1); setPartyPrices(n); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "custom" && (
                <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="text-lg font-medium text-slate-800 mb-4">Additional Details</h3>
                  {customFieldDefs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 border-2 border-dashed rounded-xl bg-slate-50">
                      No custom fields defined for items. You can create them in Settings.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-6">
                      {customFieldDefs.map(cf => (
                        <div key={cf.id} className="space-y-3">
                          <Label className="text-slate-600">{cf.field_name} {cf.is_required && <span className="text-destructive">*</span>}</Label>
                          {cf.field_type === 'select' ? (
                            <Select 
                              value={customFieldValues[cf.id] || ""} 
                              onValueChange={v => setCustomFieldValues({...customFieldValues, [cf.id]: v})}
                            >
                              <SelectTrigger className="h-11 bg-white">
                                <SelectValue placeholder={`Select ${cf.field_name}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.isArray(cf.field_options) && cf.field_options.map((opt: any) => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : cf.field_type === 'boolean' ? (
                            <div className="flex items-center h-11">
                              <Switch 
                                checked={customFieldValues[cf.id] === 'true'} 
                                onCheckedChange={c => setCustomFieldValues({...customFieldValues, [cf.id]: c ? 'true' : 'false'})}
                              />
                            </div>
                          ) : (
                            <Input 
                              type={cf.field_type === 'number' ? 'number' : cf.field_type === 'date' ? 'date' : 'text'}
                              value={customFieldValues[cf.id] || ""} 
                              onChange={e => setCustomFieldValues({...customFieldValues, [cf.id]: e.target.value})}
                              className="h-11 bg-white" 
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
            </div>
          </div>

          <div className="p-4 bg-white border-t flex justify-between items-center z-10">
            <Button variant="outline" className="h-11 px-8 rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
            <div className="flex gap-3">
              <Button disabled={loading} variant="outline" className="h-11 px-6 rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => handleSave(true)}>
                Save & New
              </Button>
              <Button disabled={loading} className="h-11 px-8 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm font-medium" onClick={() => handleSave(false)}>
                {loading ? "Saving..." : "Save Item"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
