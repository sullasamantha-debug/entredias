import { createFileRoute, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Leaf, BookHeart, Calendar, Activity, Coffee, Film, Wallet, Cake } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
  head: () => ({
    meta: [
      { title: "Entre Dias — Transforme sua rotina em memória" },
      { name: "description", content: "Seu espaço pessoal para organizar a vida: diário, hábitos, leituras, filmes, séries, podcasts, agenda e finanças." },
    ],
  }),
});

const features = [
  { icon: BookHeart, label: "Diário pessoal", hint: "registre o seu dia" },
  { icon: Activity, label: "Hábitos & rotina", hint: "histórico contínuo" },
  { icon: Coffee, label: "Podcasts", hint: "biblioteca + episódios" },
  { icon: Film, label: "Filmes & séries", hint: "memórias de tela" },
  { icon: Calendar, label: "Agenda & log futuro", hint: "sem pressa" },
  { icon: Cake, label: "Aniversários", hint: "quem te importa" },
  { icon: Wallet, label: "Finanças leves", hint: "entradas e saídas" },
  { icon: Leaf, label: "Suas memórias", hint: "guardadas com carinho" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-40 right-10 h-[320px] w-[320px] rounded-full bg-blush/40 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[280px] w-[280px] rounded-full bg-mint/40 blur-3xl" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-primary/40 to-blush/50 text-primary-foreground shadow-sm">
            <Leaf className="h-5 w-5" />
          </div>
          <span className="font-display text-xl">Entre Dias</span>
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
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Um espaço pessoal, sem barulho
          </div>
          <h1 className="font-display text-5xl leading-[1.05] text-foreground md:text-7xl">
            Transforme sua <span className="gradient-cozy-text">rotina</span> em <span className="gradient-cozy-text">memória</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            Seu espaço pessoal para organizar a vida. Diário, hábitos, leituras, filmes,
            finanças e tudo o que importa — guardado com leveza.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/login" search={{ mode: "signup" }} className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:translate-y-[-1px]">
              Começar gratuitamente
            </Link>
            <Link to="/login" className="rounded-full border border-border bg-card/70 px-6 py-3 text-sm backdrop-blur hover:bg-card">
              Já tenho conta
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mx-auto mt-20 grid max-w-5xl grid-cols-2 gap-3 md:grid-cols-4"
        >
          {features.map((f) => (
            <motion.div
              key={f.label}
              whileHover={{ y: -3 }}
              className="cozy-card flex items-start gap-3 px-4 py-4"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-[11px] text-muted-foreground">{f.hint}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
