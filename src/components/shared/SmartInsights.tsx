import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Award, Clock } from "lucide-react";

interface InsightProps {
  invoices: any[];
  payments: any[];
  expenses: any[];
  clients: any[];
  currency: string;
}

interface Insight {
  icon: any;
  color: string;
  text: string;
  type: "positive" | "negative" | "neutral";
}

export function SmartInsights({ invoices, payments, expenses, clients, currency }: InsightProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const insights = useMemo(() => {
    const result: Insight[] = [];
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

    // Revenue growth
    const thisMonthRev = payments.filter(p => (p.payment_date || "").startsWith(thisMonth)).reduce((s, p) => s + Number(p.amount), 0);
    const lastMonthRev = payments.filter(p => (p.payment_date || "").startsWith(lastMonth)).reduce((s, p) => s + Number(p.amount), 0);
    if (lastMonthRev > 0) {
      const growth = ((thisMonthRev - lastMonthRev) / lastMonthRev * 100);
      if (growth > 0) {
        result.push({ icon: TrendingUp, color: "text-success", text: `Revenue up ${growth.toFixed(0)}% vs last month (${fmt(thisMonthRev)})`, type: "positive" });
      } else if (growth < -10) {
        result.push({ icon: TrendingDown, color: "text-destructive", text: `Revenue down ${Math.abs(growth).toFixed(0)}% vs last month`, type: "negative" });
      }
    } else if (thisMonthRev > 0) {
      result.push({ icon: TrendingUp, color: "text-success", text: `${fmt(thisMonthRev)} collected this month — great start!`, type: "positive" });
    }

    // Overdue invoices warning
    const overdueInvs = invoices.filter(i => {
      if (i.status === "void" || i.status === "paid" || Number(i.balance_due) <= 0) return false;
      return new Date(i.due_date) < now;
    });
    if (overdueInvs.length > 0) {
      const overdueTotal = overdueInvs.reduce((s, i) => s + Number(i.balance_due), 0);
      result.push({ icon: AlertTriangle, color: "text-destructive", text: `${overdueInvs.length} overdue invoice(s) totaling ${fmt(overdueTotal)} — follow up!`, type: "negative" });
    }

    // Top client insight
    const clientRevMap: Record<string, { name: string; total: number }> = {};
    invoices.forEach(i => {
      const cId = i.client_id;
      const client = clients.find(c => c.id === cId);
      if (!clientRevMap[cId]) clientRevMap[cId] = { name: client?.display_name || "Unknown", total: 0 };
      clientRevMap[cId].total += Number(i.total);
    });
    const topClient = Object.values(clientRevMap).sort((a, b) => b.total - a.total)[0];
    if (topClient && topClient.total > 0) {
      result.push({ icon: Award, color: "text-primary", text: `Top client: ${topClient.name} with ${fmt(topClient.total)} in revenue`, type: "neutral" });
    }

    // Average payment time
    const paidInvs = invoices.filter(i => i.status === "paid" && i.paid_at && i.issue_date);
    if (paidInvs.length >= 3) {
      const avgDays = Math.round(paidInvs.reduce((s, i) => {
        const diff = (new Date(i.paid_at).getTime() - new Date(i.issue_date).getTime()) / 86400000;
        return s + diff;
      }, 0) / paidInvs.length);
      if (avgDays <= 15) {
        result.push({ icon: Zap, color: "text-success", text: `Clients pay in avg ${avgDays} days — excellent cash flow!`, type: "positive" });
      } else if (avgDays > 30) {
        result.push({ icon: Clock, color: "text-warning", text: `Avg payment time is ${avgDays} days — consider shorter terms`, type: "negative" });
      }
    }

    // Expense trend
    const thisMonthExp = expenses.filter(e => (e.expense_date || "").startsWith(thisMonth)).reduce((s, e) => s + Number(e.amount), 0);
    const lastMonthExp = expenses.filter(e => (e.expense_date || "").startsWith(lastMonth)).reduce((s, e) => s + Number(e.amount), 0);
    if (lastMonthExp > 0 && thisMonthExp > lastMonthExp * 1.2) {
      result.push({ icon: TrendingUp, color: "text-warning", text: `Expenses up ${((thisMonthExp - lastMonthExp) / lastMonthExp * 100).toFixed(0)}% — review spending`, type: "negative" });
    }

    return result.slice(0, 4);
  }, [invoices, payments, expenses, clients, currency]);

  if (insights.length === 0) return null;

  return (
    <div className="insights-banner px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="kpi-pill kpi-pill-blue" style={{ padding: "4px 8px" }}>
          <Zap className="h-3.5 w-3.5" />
          <span className="text-[11px] uppercase tracking-wider">Smart Insights</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <insight.icon className={`h-4 w-4 mt-0.5 shrink-0 ${insight.color}`} />
            <span className="text-foreground">{insight.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
