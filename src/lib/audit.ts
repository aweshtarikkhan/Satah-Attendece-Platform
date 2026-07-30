import { supabase } from "@/integrations/supabase/client";

export async function logAudit(params: {
  orgId: string;
  userId: string;
  entityType: string;
  entityId?: string;
  action: string;
  description: string;
  metadata?: Record<string, any>;
}) {
  await supabase.from("audit_logs").insert({
    org_id: params.orgId,
    user_id: params.userId,
    entity_type: params.entityType,
    entity_id: params.entityId || null,
    action: params.action,
    description: params.description,
    metadata: params.metadata || {},
  });
}
