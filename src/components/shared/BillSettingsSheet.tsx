import { useAppStore } from "@/store/app-store";
import { supabase } from "@/integrations/supabase/client";
import { DOCUMENT_TEMPLATES, PAPER_SIZES } from "@/lib/document-templates";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Settings2, Check } from "lucide-react";
import { useState, useEffect } from "react";

export function BillSettingsSheet() {
  const org = useAppStore((s) => s.organization);
  const setOrganization = useAppStore((s) => s.setOrganization);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [settings, setSettings] = useState({
    template_style: "classic",
    template_paper_size: "a4",
    template_accent_color: "#2563eb",
    template_font: "Inter",
    template_show_logo: true,
    gst_enabled: false,
    gst_number: "",
    show_client_gst: false,
    qr_code_enabled: false,
  });

  useEffect(() => {
    if (!org) return;
    setSettings({
      template_style: org.template_style || "classic",
      template_paper_size: org.template_paper_size || "a4",
      template_accent_color: org.template_accent_color || "#2563eb",
      template_font: org.template_font || "Inter",
      template_show_logo: org.template_show_logo ?? true,
      gst_enabled: org.gst_enabled || false,
      gst_number: org.gst_number || "",
      show_client_gst: org.show_client_gst || false,
      qr_code_enabled: org.qr_code_enabled || false,
    });
  }, [org]);

  const save = async () => {
    if (!org?.id) return;
    const { error } = await supabase.from("organizations").update(settings).eq("id", org.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrganization({ ...org, ...settings } as any);
      toast({ title: "Bill settings saved!" });
      setOpen(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-1.5 h-4 w-4" /> Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[440px] p-0">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Bill Settings</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-140px)] px-6">
          <div className="space-y-6 py-4">

            {/* Template */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Template</Label>
              <div className="grid grid-cols-2 gap-2">
                {DOCUMENT_TEMPLATES.filter(
                  (t) => ((t as any).recommendedPaperSize || "a4") === settings.template_paper_size
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSettings({ ...settings, template_style: t.id })}
                    className={`relative p-3 rounded-lg border text-left text-xs transition-all ${
                      settings.template_style === t.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {settings.template_style === t.id && (
                      <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />
                    )}
                    <span className="font-medium">{t.name}</span>
                    <p className="text-muted-foreground text-[10px] mt-0.5 line-clamp-1">{t.description}</p>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Showing templates for {settings.template_paper_size?.toUpperCase()}.</p>
            </div>

            <Separator />

            {/* Paper Size */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Paper Size</Label>
              <Select value={settings.template_paper_size} onValueChange={(v) => {
                const compatible = DOCUMENT_TEMPLATES.filter((t) => ((t as any).recommendedPaperSize || "a4") === v);
                const stillOk = compatible.some((t) => t.id === settings.template_style);
                setSettings({
                  ...settings,
                  template_paper_size: v,
                  template_style: stillOk ? settings.template_style : (compatible[0]?.id || settings.template_style),
                });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAPER_SIZES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.dimensions})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Accent Color & Font */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Accent Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.template_accent_color}
                    onChange={(e) => setSettings({ ...settings, template_accent_color: e.target.value })}
                    className="h-9 w-9 rounded border border-input cursor-pointer"
                  />
                  <Input
                    value={settings.template_accent_color}
                    onChange={(e) => setSettings({ ...settings, template_accent_color: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Font</Label>
                <Select value={settings.template_font} onValueChange={(v) => setSettings({ ...settings, template_font: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Inter", "Poppins", "Roboto", "Lato", "Open Sans", "Merriweather", "Playfair Display", "Source Sans Pro"].map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Logo */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Show Logo</Label>
                <p className="text-xs text-muted-foreground">Display company logo on bill</p>
              </div>
              <Switch checked={settings.template_show_logo} onCheckedChange={(v) => setSettings({ ...settings, template_show_logo: v })} />
            </div>

            <Separator />

            {/* GST Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Enable GST</Label>
                  <p className="text-xs text-muted-foreground">Show GST details on bill</p>
                </div>
                <Switch checked={settings.gst_enabled} onCheckedChange={(v) => setSettings({ ...settings, gst_enabled: v })} />
              </div>
              {settings.gst_enabled && (
                <>
                  <div className="space-y-2">
                    <Label>Your GST Number</Label>
                    <Input
                      value={settings.gst_number}
                      onChange={(e) => setSettings({ ...settings, gst_number: e.target.value })}
                      placeholder="e.g. 22AAAAA0000A1Z5"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Show Client GST</Label>
                      <p className="text-xs text-muted-foreground">For ITC claims — shows client's GST on bill</p>
                    </div>
                    <Switch checked={settings.show_client_gst} onCheckedChange={(v) => setSettings({ ...settings, show_client_gst: v })} />
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* QR Code */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Embed QR Code</Label>
                <p className="text-xs text-muted-foreground">Add QR code for payment/verification</p>
              </div>
              <Switch checked={settings.qr_code_enabled} onCheckedChange={(v) => setSettings({ ...settings, qr_code_enabled: v })} />
            </div>

          </div>
        </ScrollArea>
        <div className="p-6 pt-3 border-t">
          <Button onClick={save} className="w-full">Save Settings</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
