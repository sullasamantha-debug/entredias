import { createFileRoute, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, BookHeart, Calendar, Activity, Coffee, Film } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

const features = [
  { icon: Activity, label: "Hábitos & streaks" },
  { icon: BookHeart, label: "Diário pessoal" },
  { icon: Coffee, label: "Podcasts" },
  { icon: Film, label: "Filmes & séries" },
  { icon: Calendar, label: "Agenda 2026" },
  { icon: Sparkles, label: "Metas do ano" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-40 right-10 h-[300px] w-[300px] rounded-full bg-blush/40 blur-3xl" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-lg">Bullet Journal <span className="text-primary">2026</span></span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Entrar</Link>
          <Link to="/login" search={{ mode: "signup" }} className="rounded-full bg-foreground px-4 py-2 text-sm text-background hover:opacity-90">
            Criar conta
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-12 pb-24 md:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Seu Life OS pessoal, suavemente organizado
          </div>
          <h1 className="font-display text-5xl leading-[1.05] text-foreground md:text-7xl">
            Um <span className="gradient-cozy-text">journal digital</span><br className="hidden md:block" /> para a sua vida em 2026.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            Rotina, hábitos, diário, leituras, filmes, séries, podcasts, metas e memórias.
            Tudo num só painel acolhedor, bonito e seu.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/login" search={{ mode: "signup" }} className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:translate-y-[-1px]">
              Começar gratuitamente
            </Link>
            <Link to="/login" className="rounded-full border border-border bg-card/60 px-6 py-3 text-sm backdrop-blur hover:bg-card">
              Já tenho conta
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-3"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.label}
              whileHover={{ y: -3 }}
              className="cozy-card flex items-center gap-3 px-4 py-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">{f.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
