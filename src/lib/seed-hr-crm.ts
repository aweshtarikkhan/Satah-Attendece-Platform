import { supabase } from "@/integrations/supabase/client";

export async function seedHrCrmData(orgId: string) {
  try {
    // Check if already seeded to prevent duplicates
    const { data: existingEmployees } = await supabase.from("employees").select("id").eq("org_id", orgId).limit(1);
    if (existingEmployees && existingEmployees.length > 0) {
      return; // Already seeded
    }

    const d = (days: number) => new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    
    // 1. Employees
    const { data: employees, error: empErr } = await supabase.from("employees").insert([
      { org_id: orgId, name: "Alice Johnson", designation: "Software Engineer", employee_code: "EMP-001", email: "alice@example.com", phone: "555-0101", joining_date: d(365), monthly_salary: 80000, paid_leaves_per_month: 2, is_active: true },
      { org_id: orgId, name: "Bob Smith", designation: "Sales Manager", employee_code: "EMP-002", email: "bob@example.com", phone: "555-0102", joining_date: d(200), monthly_salary: 95000, paid_leaves_per_month: 2, is_active: true },
      { org_id: orgId, name: "Charlie Davis", designation: "HR Coordinator", employee_code: "EMP-003", email: "charlie@example.com", phone: "555-0103", joining_date: d(100), monthly_salary: 60000, paid_leaves_per_month: 2, is_active: true }
    ]).select();
    if (empErr) throw empErr;

    // 2. Attendance & Leaves (for the last 5 days)
    if (employees && employees.length > 0) {
      const attendanceData = [];
      const leaveData = [];
      for (const emp of employees) {
        for (let i = 0; i < 5; i++) {
          const date = d(i);
          // Make Charlie on leave 2 days ago
          if (emp.name === "Charlie Davis" && i === 2) {
            leaveData.push({ org_id: orgId, employee_id: emp.id, start_date: date, end_date: date, reason: "Sick Leave", status: "approved", type: "sick" });
            attendanceData.push({ org_id: orgId, employee_id: emp.id, date, status: "leave" });
          } else {
            attendanceData.push({ org_id: orgId, employee_id: emp.id, date, status: "present", check_in: "09:00:00", check_out: "17:00:00" });
          }
        }
      }
      await supabase.from("attendance").insert(attendanceData);
      if (leaveData.length > 0) await supabase.from("leaves").insert(leaveData);
    }

    // 3. Shifts
    const { data: shifts, error: shiftErr } = await supabase.from("shifts").insert([
      { org_id: orgId, name: "Morning Shift", start_time: "09:00:00", end_time: "17:00:00" },
      { org_id: orgId, name: "Night Shift", start_time: "21:00:00", end_time: "05:00:00" }
    ]).select();
    if (shiftErr) throw shiftErr;

    // 4. Documents (Dummy entry for Alice)
    if (employees && employees.length > 0) {
      await supabase.from("employee_documents").insert([
        { org_id: orgId, employee_id: employees[0].id, name: "Offer Letter", document_url: "dummy-url", type: "contract" }
      ]);
    }

    // 5. Payroll Runs
    await supabase.from("payroll_runs").insert([
      { org_id: orgId, month: "June", year: 2026, status: "draft" }
    ]);

    // 6. Leads
    const { data: leads, error: leadsErr } = await supabase.from("leads").insert([
      { org_id: orgId, name: "John Doe", company: "Acme Corp", email: "john@acme.com", status: "new", estimated_value: 15000, source: "Website" },
      { org_id: orgId, name: "Jane Smith", company: "TechFlow", email: "jane@techflow.com", status: "contacted", estimated_value: 25000, source: "Referral" },
      { org_id: orgId, name: "Mike Johnson", company: "Global Inc", email: "mike@global.com", status: "qualified", estimated_value: 50000, source: "LinkedIn" }
    ]).select();
    if (leadsErr) throw leadsErr;

    // 7. Pipeline (Opportunities)
    // First ensure there are pipeline stages
    let { data: stages } = await supabase.from("pipeline_stages").select("*").eq("org_id", orgId);
    if (!stages || stages.length === 0) {
      await (supabase as any).rpc("seed_default_pipeline", { p_org_id: orgId });
      const { data: newStages } = await supabase.from("pipeline_stages").select("*").eq("org_id", orgId);
      stages = newStages || [];
    }
    
    if (stages && stages.length > 0) {
      const opps = [
        { org_id: orgId, title: "Acme Corp Deal", amount: 15000, stage_id: stages[0].id, expected_close_date: d(-10), probability: 20 },
        { org_id: orgId, title: "TechFlow Contract", amount: 25000, stage_id: stages[1]?.id || stages[0].id, expected_close_date: d(-5), probability: 50 }
      ];
      await supabase.from("opportunities").insert(opps);
    }

    // 8. Activities (For the first lead)
    if (leads && leads.length > 0) {
      await supabase.from("activities").insert([
        { org_id: orgId, lead_id: leads[0].id, type: "call", title: "Introductory Call", status: "completed", due_date: d(1), notes: "Had a great intro call, they are interested." },
        { org_id: orgId, lead_id: leads[1].id, type: "email", title: "Follow-up Email", status: "pending", due_date: d(-1) }
      ]);
    }

    // Seed complete without reload
    console.log("HR and CRM demo data has been added successfully.");
  } catch (error: any) {
    console.error("Seed error:", error);
  }
}
