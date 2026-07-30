import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface CustomFieldsFormProps {
  entityType: string;
  entityId?: string;
  onChange?: (values: Record<string, string>) => void;
}

export function CustomFieldsForm({ entityType, entityId, onChange }: CustomFieldsFormProps) {
  const org = useAppStore((s) => s.organization);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!org?.id) return;
    const load = async () => {
      const { data: defs } = await supabase
        .from("custom_field_definitions")
        .select("*")
        .eq("org_id", org.id)
        .eq("entity_type", entityType)
        .order("sort_order");
      setDefinitions(defs || []);

      if (entityId && defs?.length) {
        const { data: vals } = await supabase
          .from("custom_field_values")
          .select("*")
          .eq("entity_id", entityId)
          .in("field_id", defs.map((d) => d.id));

        const valMap: Record<string, string> = {};
        vals?.forEach((v: any) => { valMap[v.field_id] = v.value || ""; });
        setValues(valMap);
      }
    };
    load();
  }, [org?.id, entityType, entityId]);

  const handleChange = (fieldId: string, value: string) => {
    const newValues = { ...values, [fieldId]: value };
    setValues(newValues);
    onChange?.(newValues);
  };

  if (definitions.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Custom Fields</p>
      <div className="grid grid-cols-2 gap-3">
        {definitions.map((def) => (
          <div key={def.id} className="space-y-1">
            <Label className="text-xs">
              {def.field_name} {def.is_required && <span className="text-destructive">*</span>}
            </Label>
            {def.field_type === "text" && (
              <Input className="h-8 text-sm" value={values[def.id] || ""} onChange={(e) => handleChange(def.id, e.target.value)} />
            )}
            {def.field_type === "number" && (
              <Input className="h-8 text-sm" type="number" value={values[def.id] || ""} onChange={(e) => handleChange(def.id, e.target.value)} />
            )}
            {def.field_type === "date" && (
              <Input className="h-8 text-sm" type="date" value={values[def.id] || ""} onChange={(e) => handleChange(def.id, e.target.value)} />
            )}
            {def.field_type === "dropdown" && (
              <Select value={values[def.id] || ""} onValueChange={(v) => handleChange(def.id, v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {(def.field_options as string[])?.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {def.field_type === "checkbox" && (
              <Checkbox checked={values[def.id] === "true"} onCheckedChange={(v) => handleChange(def.id, v ? "true" : "false")} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export async function saveCustomFieldValues(entityId: string, values: Record<string, string>) {
  for (const [fieldId, value] of Object.entries(values)) {
    await supabase.from("custom_field_values").upsert({
      field_id: fieldId,
      entity_id: entityId,
      value,
    }, { onConflict: "field_id,entity_id" });
  }
}
