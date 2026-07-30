import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

const routes = [
  { label: "Dashboard", path: "/dashboard", group: "Pages" },
  { label: "Invoices", path: "/invoices", group: "Pages" },
  { label: "New Invoice", path: "/invoices/new", group: "Actions" },
  { label: "Clients", path: "/clients", group: "Pages" },
  { label: "Items", path: "/items", group: "Pages" },
  { label: "Payments", path: "/payments", group: "Pages" },
  { label: "Settings", path: "/settings", group: "Pages" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <>
      <button
        className="flex h-10 w-64 items-center justify-between rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span>Search anything...</span>
        </div>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded bg-slate-200/50 px-1.5 font-mono text-[10px] font-medium text-slate-500 opacity-100 sm:flex dark:bg-slate-800 dark:text-slate-400">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages and actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {["Pages", "Actions"].map((group) => {
            const items = routes.filter((r) => r.group === group);
            if (!items.length) return null;
            return (
              <CommandGroup key={group} heading={group}>
                {items.map((item) => (
                  <CommandItem
                    key={item.path}
                    onSelect={() => handleSelect(item.path)}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
