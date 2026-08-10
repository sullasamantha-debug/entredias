import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { mode?: string; next?: string } => ({
    mode: (s.mode as string) === "signup" ? "signup" : "login",
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),

  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ href: search.next ?? "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const { mode, next } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${next ?? "/dashboard"}`,
            data: { display_name: name },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu email para confirmar.");
        // try direct login (if email confirmation off)
        const { data } = await supabase.auth.signInWithPassword({ email, password });
        if (data.session) {
          if (next) window.location.href = next;
          else navigate({ to: "/dashboard" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vinda de volta ✨");
        if (next) window.location.href = next;
        else navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const e = err as Error & { name?: string; status?: number };
      console.error("[auth] login error:", e);
      const msg = e?.message ?? "";
      const isFetchFail =
        msg === "Failed to fetch" ||
        msg.toLowerCase().includes("failed to fetch") ||
        e?.name === "AuthRetryableFetchError" ||
        e?.name === "TypeError";

      if (isFetchFail) {
        toast.error(
          "Não foi possível conectar ao servidor de autenticação. Se você está no preview, tente novamente ou acesse pelo domínio publicado (entredias.lovable.app)."
        );
      } else if (msg.includes("Invalid login credentials")) {
        toast.error("Email ou senha incorretos.");
      } else if (msg.includes("Email not confirmed")) {
        toast.error("Confirme seu email antes de entrar.");
      } else if (msg.includes("User already registered")) {
        toast.error("Este email já está cadastrado. Faça login.");
      } else {
        toast.error(msg || "Não foi possível completar a ação. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute -top-40 left-1/2 -z-10 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute top-40 right-10 -z-10 h-[300px] w-[300px] rounded-full bg-blush/40 blur-3xl" />

      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-lg">Bullet Journal 2026</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="cozy-card w-full p-8"
        >
          <h1 className="font-display text-2xl">
            {mode === "signup" ? "Crie seu journal" : "Bem-vinda de volta"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Comece um novo ciclo." : "Continue de onde parou."}
          </p>

          <form onSubmit={handle} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Como podemos te chamar?</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button disabled={loading} className="w-full rounded-full" size="lg">
              {loading ? "Aguarde..." : mode === "signup" ? "Criar conta" : "Entrar"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>Já tem conta? <Link to="/login" search={{ mode: "login", next }} className="text-primary hover:underline">Entrar</Link></>
            ) : (
              <>Novo por aqui? <Link to="/login" search={{ mode: "signup", next }} className="text-primary hover:underline">Criar conta</Link></>
            )}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
