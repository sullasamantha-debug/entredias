import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, BookHeart, Activity, Mic, Tv, Film, BookOpen,
  Calendar, Cake, Target, Moon, Sun, LogOut, Wallet, Download, Leaf, Menu, ListChecks,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/diario", label: "Diário", icon: BookHeart },
  { to: "/habitos", label: "Hábitos", icon: Activity },
  { to: "/podcasts", label: "Podcasts", icon: Mic },
  { to: "/series", label: "Séries", icon: Tv },
  { to: "/filmes", label: "Filmes", icon: Film },
  { to: "/livros", label: "Livros", icon: BookOpen },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/aniversarios", label: "Aniversários", icon: Cake },
  { to: "/financas", label: "Finanças", icon: Wallet },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/listas", label: "Listas", icon: ListChecks },
  { to: "/exportar", label: "Exportar", icon: Download },

] as const;

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Até logo ✨");
    onNavigate?.();
    navigate({ to: "/" });
  };

  return (
    <div className="flex h-full flex-col">
      <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2 px-2 py-2">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-primary/40 to-blush/50 text-primary-foreground shadow-sm">
          <Leaf className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg leading-tight">Entre Dias</div>
          <div className="text-[11px] text-muted-foreground">Sua rotina, sua memória</div>
        </div>
      </Link>

      <nav className="mt-6 flex flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
        {nav.map((item) => {
          const active = path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to));
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute inset-y-1 left-0 w-1 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 flex items-center gap-2 rounded-xl px-2 py-2 text-xs">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-blush/40 font-display text-sm text-blush-foreground">
            {(user?.email ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-foreground">{user?.user_metadata?.display_name ?? user?.email?.split("@")[0]}</div>
            <div className="truncate text-[11px] text-muted-foreground">{user?.email}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={toggle} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs hover:bg-accent">
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {theme === "dark" ? "Claro" : "Escuro"}
          </button>
          <button onClick={logout} className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-accent hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-sidebar p-4 md:block">
      <NavContent />
    </aside>
  );
}

export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button aria-label="Abrir menu" className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:bg-accent">
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-4">
          <NavContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary/40 to-blush/50 text-primary-foreground">
          <Leaf className="h-4 w-4" />
        </div>
        <span className="font-display text-base">Entre Dias</span>
      </Link>

      <button onClick={toggle} aria-label="Alternar tema" className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:bg-accent">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </header>
  );
}

export function MobileTabBar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const items = [
    nav[0], // Dashboard
    nav[1], // Diário
    nav[9], // Finanças
    nav[7], // Agenda
    nav[2], // Hábitos
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur md:hidden">
      {items.map((i) => {
        const active = path === i.to || (i.to !== "/dashboard" && path.startsWith(i.to));
        return (
          <Link key={i.to} to={i.to} className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
            <i.icon className="h-5 w-5" />
            <span>{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
