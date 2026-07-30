import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { fetchGstDetails } from "@/lib/gst-service";

interface AddVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVendorAdded: (vendor: { id: string; display_name: string }) => void;
}

export function AddVendorDialog({ open, onOpenChange, onVendorAdded }: AddVendorDialogProps) {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingZip, setBillingZip] = useState("");
  const [isFetchingGst, setIsFetchingGst] = useState(false);

  const reset = () => {
    setDisplayName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setGstNumber("");
    setBillingAddress("");
    setBillingState("");
    setBillingZip("");
  };

  const handleFetchGst = async () => {
    if (!gstNumber || gstNumber.length !== 15) {
      toast({ title: "Invalid GST", description: "Please enter a valid 15-character GSTIN", variant: "destructive" });
      return;
    }
    setIsFetchingGst(true);
    try {
      const details = await fetchGstDetails(gstNumber);
      if (!companyName) setCompanyName(details.legalName || details.tradeName || "");
      if (!displayName) setDisplayName(details.tradeName || details.legalName || "");
      setBillingAddress(details.address || "");
      setBillingState(details.state || "");
      setBillingZip(details.pincode || "");
      toast({ title: "GST Details Fetched", description: "Business details auto-filled successfully!" });
    } catch (err: any) {
      toast({ title: "GST Fetch Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsFetchingGst(false);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim() || !org?.id) {
      toast({ title: "Display name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("vendors").insert({
      org_id: org.id,
      display_name: displayName.trim(),
      name: companyName.trim() || displayName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      gstin: gstNumber.trim() || null,
      billing_address: {
        street: billingAddress.trim() || null,
        city: "",
        state: billingState.trim() || null,
        zip: billingZip.trim() || null,
        country: "",
      },
    }).select("*").single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      toast({ title: "Vendor added!" });
      onVendorAdded(data);
      reset();
      onOpenChange(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Vendor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto px-1">
          <div className="space-y-2">
            <Label>GST Number</Label>
            <div className="flex gap-2">
              <Input 
                value={gstNumber} 
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())} 
                placeholder="e.g. 22AAAAA0000A1Z5" 
                maxLength={15}
              />
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleFetchGst}
                disabled={isFetchingGst || gstNumber.length !== 15}
              >
                {isFetchingGst ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Fetch Details
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Display Name *</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Vendor name" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Billing Address</Label>
            <Textarea value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} rows={2} placeholder="Full address" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>State (GST Code)</Label>
              <Select value={billingState} onValueChange={setBillingState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="27">27 - Maharashtra</SelectItem>
                  <SelectItem value="07">07 - Delhi</SelectItem>
                  <SelectItem value="09">09 - Uttar Pradesh</SelectItem>
                  <SelectItem value="24">24 - Gujarat</SelectItem>
                  <SelectItem value="29">29 - Karnataka</SelectItem>
                  <SelectItem value="33">33 - Tamil Nadu</SelectItem>
                  <SelectItem value="19">19 - West Bengal</SelectItem>
                  <SelectItem value="08">08 - Rajasthan</SelectItem>
                  <SelectItem value="00">00 - Other / Unregistered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pincode / ZIP</Label>
              <Input value={billingZip} onChange={(e) => setBillingZip(e.target.value)} placeholder="Pincode" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Add Vendor"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
