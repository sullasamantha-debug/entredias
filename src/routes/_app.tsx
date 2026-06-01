import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, MobileTabBar, MobileTopBar } from "@/components/AppSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_app")({
  // Disable SSR for the authenticated app shell so unauthenticated requests
  // never receive the protected layout HTML. Auth gating runs on the client.
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppShell,
});

function AppShell() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="relative flex-1 pb-24 md:pb-0">
        <div className="absolute inset-x-0 top-0 -z-10 h-72 gradient-soft opacity-50" />
        <AnimatePresence mode="wait">
          <motion.div
            key={path}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10"
          >
            {mounted && <Outlet />}
          </motion.div>
        </AnimatePresence>
      </main>
      <MobileTabBar />
    </div>
  );
}
