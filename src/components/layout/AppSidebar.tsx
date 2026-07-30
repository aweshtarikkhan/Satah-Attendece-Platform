import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  CreditCard,
  Settings,
  Receipt,
  LogOut,
  ClipboardList,
  BarChart3,
  FileMinus2,
  Coins,
  Layout,
  FileSpreadsheet,
  ScrollText,
  SlidersHorizontal,
  Plus,
  RefreshCw,
  PieChart,
  Boxes,
  UserCog,
  CalendarCheck,
  FileBarChart2,
  Truck,
  PackageCheck,
  BookOpen,
  Building2,
  Percent,
  Calculator,
  Landmark,
  Send,
  MessageSquare,
  Workflow,
  ChevronDown,
  ChevronRight,
  Check,
  ShoppingCart,
  Shield,
} from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useFeatureStore, ADMIN_FEATURE_GROUPS } from "@/store/feature-store";
import logoImg from "@/assets/logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage } from "@/lib/i18n";

const salesItems = [
  { title: "Invoices", url: "/invoices", icon: FileText, addUrl: "/invoices/new" },
  { title: "Estimates", url: "/estimates", icon: ClipboardList, addUrl: "/estimates/new" },
  { title: "Clients", url: "/clients", icon: Users, addUrl: "/clients?add=1" },
  { title: "Credit Notes", url: "/credit-notes", icon: FileMinus2, addUrl: "/credit-notes/new" },
  { title: "Payments Received", url: "/payments", icon: CreditCard, addUrl: "/payments/new" },
  { title: "Delivery Challans", url: "/delivery-challans", icon: Truck, addUrl: "/delivery-challans/new" },
  { title: "Recurring", url: "/recurring-invoices", icon: RefreshCw, addUrl: null },
];

const purchaseItems = [
  { title: "Vendors", url: "/vendors", icon: Truck, addUrl: null },
  { title: "Purchase Orders", url: "/purchase-orders", icon: ClipboardList, addUrl: "/purchase-orders/new" },
  { title: "Goods Receipt (GRN)", url: "/grns", icon: PackageCheck, addUrl: "/grns/new" },
  { title: "Bills", url: "/bills", icon: Receipt, addUrl: "/bills/new" },
  { title: "Expenses", url: "/expenses", icon: Coins, addUrl: "/expenses?add=1" },
];

const accountingItems = [
  { title: "Chart of Accounts", url: "/accounts", icon: BookOpen, addUrl: null },
  { title: "Journal Entries", url: "/journal", icon: Calculator, addUrl: null },
  { title: "Bank & Cash", url: "/bank-accounts", icon: Landmark, addUrl: null },
  { title: "Cash Flow", url: "/cash-flow", icon: PieChart, addUrl: null },
  { title: "Branches", url: "/branches", icon: Building2, addUrl: null },
  { title: "TDS", url: "/tds", icon: Percent, addUrl: null },
  { title: "Accounting Reports", url: "/accounting-reports", icon: Landmark, addUrl: null },
];

const catalogItems = [
  { title: "Items", url: "/items", icon: Package, addUrl: "/items?add=1" },
];

const peopleItems = [
  { title: "Employees", url: "/employees", icon: UserCog, addUrl: null },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck, addUrl: null },
  { title: "Leaves", url: "/leaves", icon: ClipboardList, addUrl: null },
  { title: "Shifts", url: "/shifts", icon: CalendarCheck, addUrl: null },
  { title: "Documents", url: "/employee-documents", icon: ScrollText, addUrl: null },
  { title: "Payroll", url: "/payroll", icon: Calculator, addUrl: null },
];

const reportItems = [
  { title: "Statements", url: "/statements", icon: FileSpreadsheet, addUrl: null },
  { title: "Reports", url: "/reports", icon: BarChart3, addUrl: null },
  { title: "Profit & Loss", url: "/profit-loss", icon: PieChart, addUrl: null },
  { title: "GST Returns", url: "/gst-returns", icon: FileBarChart2, addUrl: null },
  { title: "Inventory Valuation", url: "/inventory-valuation", icon: Boxes, addUrl: null },
];

const crmItems = [
  { title: "Leads", url: "/leads", icon: Users, addUrl: "/leads?add=1" },
  { title: "Pipeline", url: "/pipeline", icon: BarChart3, addUrl: null },
  { title: "Activities", url: "/activities", icon: ClipboardList, addUrl: null },
];

const marketingItems = [
  { title: "Campaigns", url: "/campaigns", icon: Send, addUrl: null },
  { title: "Templates", url: "/marketing/templates", icon: MessageSquare, addUrl: null },
  { title: "Journeys", url: "/journeys", icon: Workflow, addUrl: null },
  { title: "Message Logs", url: "/message-logs", icon: ScrollText, addUrl: null },
];

const settingsItems = [
  { title: "Templates", url: "/templates", icon: Layout },
  { title: "Custom Fields", url: "/custom-fields", icon: SlidersHorizontal },
  { title: "Audit Logs", url: "/audit-logs", icon: ScrollText },
  { title: "Settings", url: "/settings", icon: Settings },
];

// Map feature group key to sidebar items
const ADMIN_GROUP_ITEMS: Record<string, { label: string; items: any[] }> = {
  purchases: { label: "Purchases", items: purchaseItems },
  accounting: { label: "Accounting", items: accountingItems },
  people: { label: "People", items: peopleItems },
  crm: { label: "CRM", items: crmItems },
  marketing: { label: "Marketing", items: marketingItems },
  reports: { label: "Reports", items: reportItems },
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, session } = useAuth();
  const org = useAppStore((s) => s.organization);
  const myOrganizations = useAppStore((s) => s.myOrganizations);
  const inventoryEnabled = (org as any)?.inventory_enabled;
  const { enabledGroups, isAdmin, teamMembers } = useFeatureStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const { t } = useLanguage();

  const currentUserEmail = session?.user?.email?.toLowerCase().trim();
  const isUserAdmin = isAdmin(currentUserEmail);
  
  // Find permissions for regular users in current org
  const currentOrgId = org?.id || "default";
  const currentTeamMember = !isUserAdmin ? (teamMembers[currentOrgId] || []).find(m => m.email === currentUserEmail) : null;
  const userPermissions = currentTeamMember?.permissions || [];

  const isGroupAccessible = (groupKey: string) => {
    if (isUserAdmin) return true; // Admins see everything that is enabled
    // Fallback: If no team members exist for this org yet, assume owner access and show everything
    if (!teamMembers[currentOrgId] || teamMembers[currentOrgId].length === 0) return true;
    return userPermissions.includes(groupKey); // Regular users see only assigned features
  };

  const catalogVisible = catalogItems.flatMap((it) => {
    if (it.url === "/items" && inventoryEnabled) {
      return [it, { title: "Inventory", url: "/inventory", icon: Boxes, addUrl: null }];
    }
    return [it];
  });

  // Default groups (always visible for admins, or if explicitly given permission)
  const defaultGroups = [
    { key: "sales", label: "Sales", items: salesItems },
    { key: "catalog", label: "Catalog", items: catalogVisible },
  ].filter(g => isGroupAccessible(g.key));

  // Admin controlled groups - mapped from the feature store
  const featureGroups = ADMIN_FEATURE_GROUPS
    .filter((g) => isGroupAccessible(g.key)) // Must be accessible by this user
    .map((g) => {
      let icon = ShoppingCart;
      if (g.icon === "Landmark") icon = Landmark;
      if (g.icon === "UserCog") icon = UserCog;
      if (g.icon === "Users") icon = Users;
      
      return {
        key: g.key,
        label: g.label,
        items: g.items.map(i => {
          let itemIcon = ShoppingCart;
          if (i.icon === "Truck") itemIcon = Truck;
          if (i.icon === "ClipboardList") itemIcon = ClipboardList;
          if (i.icon === "PackageCheck") itemIcon = PackageCheck;
          if (i.icon === "Receipt") itemIcon = Receipt;
          if (i.icon === "Landmark") itemIcon = Landmark;
          if (i.icon === "PieChart") itemIcon = PieChart;
          if (i.icon === "Building2") itemIcon = Building2;
          if (i.icon === "Percent") itemIcon = Percent;
          if (i.icon === "UserCog") itemIcon = UserCog;
          if (i.icon === "CalendarCheck") itemIcon = CalendarCheck;
          if (i.icon === "ScrollText") itemIcon = ScrollText;
          if (i.icon === "Calculator") itemIcon = Calculator;
          if (i.icon === "Users") itemIcon = Users;
          if (i.icon === "BarChart3") itemIcon = BarChart3;
          
          return {
            title: i.title,
            url: i.url,
            icon: itemIcon,
            addUrl: null
          };
        })
      };
    });

  const sidebarGroups = [...defaultGroups, ...featureGroups];

  // Check if any settings item is active to auto-open settings
  const isSettingsActive = settingsItems.some(
    (item) => location.pathname === item.url || location.pathname.startsWith(item.url + "/")
  );

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const switchOrganization = async (orgId: string) => {
    if (!profile || profile.org_id === orgId) return;
    
    // Update profile with new org_id
    const { error } = await supabase
      .from("profiles")
      .update({ org_id: orgId })
      .eq("id", profile.id);
      
    if (!error) {
      // Reload page to fetch new organization data
      window.location.href = "/dashboard";
    }
  };

  return (
    <Sidebar collapsible="icon" className="dark border-r-0 bg-[#0f172a] text-slate-200">
      <SidebarHeader className="px-4 py-6 flex flex-col gap-6">
        <NavLink to="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xl shadow-lg shadow-blue-600/20">
            S
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white leading-tight">Satah</span>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-tight">Invoice</span>
            </div>
          )}
        </NavLink>

        {/* Organization Switcher */}
        {!collapsed && myOrganizations.length > 0 && (
          <div className="px-0">
            <div className="relative group/org-switcher">
              <button className="w-full flex items-center gap-3 bg-[#1e293b] hover:bg-[#334155] text-slate-200 px-3 py-3 rounded-xl border border-slate-700/50 transition-all text-left">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Current Business</span>
                  <span className="text-sm font-bold text-white truncate">{org?.name || "Loading..."}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute top-full left-0 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg opacity-0 invisible group-hover/org-switcher:opacity-100 group-hover/org-switcher:visible transition-all duration-200 z-50 overflow-hidden">
                <div className="max-h-60 overflow-y-auto p-1">
                  {myOrganizations.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => switchOrganization(o.id)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors ${
                        o.id === org?.id 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "hover:bg-accent text-foreground"
                      }`}
                    >
                      <span className="truncate">{o.name}</span>
                      {o.id === org?.id && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  ))}
                </div>
                {isAdmin(session?.user?.email) && (
                  <div className="p-1 border-t border-border bg-muted/20">
                    <button
                      onClick={() => navigate("/admin")}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 rounded-md transition-colors flex items-center gap-2"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add New Business
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-3 gap-1">
        {/* Permanent Home / Dashboard Link */}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard")}>
                  <NavLink
                    to="/dashboard"
                    className="hover:bg-[#1e293b] hover:text-white rounded-lg transition-colors py-5"
                    activeClassName="bg-blue-600 text-white font-medium shadow-md shadow-blue-600/20"
                  >
                    <LayoutDashboard className="h-5 w-5" />
                    {!collapsed && <span className="text-sm ml-2">{t("Dashboard")}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {sidebarGroups.map((g) => {
          const isActiveGroup = g.items.some((item) => isActive(item.url) || (item.addUrl && isActive(item.addUrl)));
          const isOpen = openGroups[g.key] !== undefined ? openGroups[g.key] : isActiveGroup;

          return (
            <SidebarGroup key={g.key} className="p-0 mt-2">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setOpenGroups(prev => ({ ...prev, [g.key]: !isOpen }))}
                      className="hover:bg-[#1e293b] hover:text-white cursor-pointer h-10 rounded-lg transition-colors py-5 group/groupbtn"
                    >
                      {/* We can use the group icon if available, else a default one */}
                      {g.key === "sales" && <FileText className="h-5 w-5 opacity-70 group-hover/groupbtn:opacity-100" />}
                      {g.key === "catalog" && <Package className="h-5 w-5 opacity-70 group-hover/groupbtn:opacity-100" />}
                      {g.key === "purchases" && <ShoppingCart className="h-5 w-5 opacity-70 group-hover/groupbtn:opacity-100" />}
                      {g.key === "accounting" && <Calculator className="h-5 w-5 opacity-70 group-hover/groupbtn:opacity-100" />}
                      {g.key === "people" && <UserCog className="h-5 w-5 opacity-70 group-hover/groupbtn:opacity-100" />}
                      {g.key === "crm" && <Users className="h-5 w-5 opacity-70 group-hover/groupbtn:opacity-100" />}
                      {g.key === "marketing" && <Send className="h-5 w-5 opacity-70 group-hover/groupbtn:opacity-100" />}
                      {g.key === "reports" && <BarChart3 className="h-5 w-5 opacity-70 group-hover/groupbtn:opacity-100" />}
                      
                      <span className="flex-1 font-medium text-slate-300 group-hover/groupbtn:text-white tracking-wide text-sm ml-2">{t(g.label)}</span>
                      {!collapsed && (
                        <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  
                  {(isOpen || collapsed) && g.items.map((item) => (
                    <SidebarMenuItem key={item.title} className="group/item pl-6 mt-1">
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink
                          to={item.url}
                          className="hover:bg-[#1e293b] hover:text-white rounded-lg transition-colors py-4 text-slate-400"
                          activeClassName="bg-blue-600/10 text-blue-400 font-medium"
                        >
                          {!collapsed && <span className="text-sm">{t(item.title)}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                      {!collapsed && item.addUrl && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(item.addUrl!); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-500"
                          title={`New ${item.title.replace(/s$/, "")}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {/* Settings group - collapsible under gear icon */}
        <SidebarGroup className="p-0 mt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  isActive={isSettingsActive}
                  className="hover:bg-[#1e293b] hover:text-white cursor-pointer h-10 rounded-lg transition-colors py-5 group/groupbtn"
                >
                  <Settings className="h-5 w-5 opacity-70 group-hover/groupbtn:opacity-100" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 font-medium text-slate-300 group-hover/groupbtn:text-white tracking-wide text-sm ml-2">{t("System & Settings")}</span>
                      <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${settingsOpen || isSettingsActive ? 'rotate-90' : ''}`} />
                    </>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {(settingsOpen || isSettingsActive || collapsed) && settingsItems.map((item) => (
                <SidebarMenuItem key={item.title} className="pl-6 mt-1">
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="hover:bg-[#1e293b] hover:text-white rounded-lg transition-colors py-4 text-slate-400"
                      activeClassName="bg-blue-600/10 text-blue-400 font-medium"
                    >
                      {!collapsed && <span className="text-sm">{t(item.title)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Admin Panel link - only visible to admins */}
              {isAdmin(session?.user?.email) && (
                <SidebarMenuItem className="mt-2">
                  <SidebarMenuButton asChild isActive={isActive("/admin")}>
                    <NavLink
                      to="/admin"
                      className="hover:bg-[#1e293b] hover:text-white rounded-lg transition-colors py-5"
                      activeClassName="bg-blue-600 text-white font-medium shadow-md shadow-blue-600/20"
                    >
                      <Shield className="h-5 w-5" />
                      {!collapsed && <span className="ml-2 text-sm">{t("Admin Panel")}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-800/50 p-4 pb-6 flex flex-col gap-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="w-full flex items-center gap-3 bg-transparent hover:bg-slate-800/50 text-slate-300 hover:text-white px-3 py-5 rounded-xl border border-slate-700/50 transition-all text-left"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="font-medium text-sm">{t("Sign Out")}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && (
          <div className="flex items-center justify-between px-3 mt-2">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">Satah Invoice</span>
              <span className="text-[10px] text-slate-500">Version 2.0.0</span>
            </div>
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="System Online"></div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
