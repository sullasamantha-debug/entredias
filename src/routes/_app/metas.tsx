import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, EmptyState, StatCard } from "@/components/cozy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Target, Plus, Trash2, Check, Trophy, Heart, ListChecks } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/metas")({ component: MetasPage });

function MetasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const year = new Date().getFullYear();
  const [form, setForm] = useState({ title: "", description: "", target: 1, progress: 0, year });

  const { data: list } = useQuery({
    enabled: !!user, queryKey: ["goals", user?.id],
    queryFn: async () => (await supabase.from("goals").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: linkedTasks } = useQuery({
    enabled: !!user, queryKey: ["tasks", user?.id],
    queryFn: async () => (await supabase.from("tasks").select("id,title,status,goal_id").not("goal_id", "is", null)).data ?? [],
  });
  const { data: linkedWishes } = useQuery({
    enabled: !!user, queryKey: ["wishes", user?.id],
    queryFn: async () => (await supabase.from("wishes").select("id,name,status,goal_id").not("goal_id", "is", null)).data ?? [],
  });


  const save = async () => {
    if (!user || !form.title) return;
    const { error } = await supabase.from("goals").insert({ ...form, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); qc.invalidateQueries({ queryKey: ["goals"] });
  };
  const remove = async (id: string) => { await supabase.from("goals").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["goals"] }); };
  const update = async (id: string, progress: number, target: number) => {
    const completed = progress >= target;
    await supabase.from("goals").update({ progress, completed }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["goals"] });
  };

  const completed = (list ?? []).filter((g) => g.completed).length;
  const overall = list?.length ? Math.round((completed / list.length) * 100) : 0;

  return (
    <div>
      <PageHeader icon={Target} title={`Metas ${year}`} subtitle="O que você quer viver este ano."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="rounded-full"><Plus className="mr-1 h-4 w-4" />Nova meta</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Nova meta</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ler 20 livros" /></div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Meta</Label><Input type="number" value={form.target} onChange={(e) => setForm({ ...form, target: +e.target.value })} /></div>
                  <div><Label>Progresso</Label><Input type="number" value={form.progress} onChange={(e) => setForm({ ...form, progress: +e.target.value })} /></div>
                </div>
                <Button onClick={save} className="w-full rounded-full">Criar meta</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Metas" value={list?.length ?? 0} icon={Target} />
        <StatCard label="Concluídas" value={completed} icon={Trophy} tint="mint" />
        <StatCard label="Progresso" value={`${overall}%`} tint="blush" />
        <StatCard label="Em andamento" value={(list?.length ?? 0) - completed} tint="sand" />
      </div>

      {!list?.length ? <EmptyState title="Sonhe grande, comece pequeno" description="Cadastre sua primeira meta do ano." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((g, i) => {
            const pct = g.target ? Math.min(100, (Number(g.progress) / Number(g.target)) * 100) : 0;
            return (
              <motion.div key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className={`cozy-card p-5 ${g.completed ? "bg-mint/20" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {g.completed && <Check className="h-4 w-4 text-primary" />}
                      <h3 className={`font-display text-lg ${g.completed ? "line-through text-muted-foreground" : ""}`}>{g.title}</h3>
                    </div>
                    {g.description && <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>}
                  </div>
                  <button onClick={() => remove(g.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{Number(g.progress)} / {Number(g.target)}</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => update(g.id, Math.max(0, Number(g.progress) - 1), Number(g.target))} className="rounded-lg border border-border px-3 text-sm hover:bg-accent">−</button>
                    <button onClick={() => update(g.id, Number(g.progress) + 1, Number(g.target))} className="rounded-lg border border-border px-3 text-sm hover:bg-accent">+1</button>
                  </div>
                </div>
                {(() => {
                  const gt = (linkedTasks ?? []).filter((t) => t.goal_id === g.id);
                  const gw = (linkedWishes ?? []).filter((w) => w.goal_id === g.id);
                  if (!gt.length && !gw.length) return null;
                  return (
                    <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs">
                      {gw.length > 0 && (
                        <div>
                          <div className="mb-1 flex items-center gap-1 text-muted-foreground"><Heart className="h-3 w-3" />Desejos</div>
                          {gw.map((w) => (
                            <div key={w.id} className={w.status === "realizado" ? "text-muted-foreground line-through" : ""}>
                              {w.status === "realizado" ? "☑" : "☐"} {w.name}
                            </div>
                          ))}
                        </div>
                      )}
                      {gt.length > 0 && (
                        <div>
                          <div className="mb-1 flex items-center gap-1 text-muted-foreground"><ListChecks className="h-3 w-3" />Tarefas</div>
                          {gt.map((t) => (
                            <div key={t.id} className={t.status === "concluida" ? "text-muted-foreground line-through" : ""}>
                              {t.status === "concluida" ? "☑" : "☐"} {t.title}
                            </div>
                          ))}
                        </div>
                      )}
                      <Link to="/listas" className="inline-block text-primary hover:underline">Abrir Listas →</Link>
                    </div>
                  );
                })()}

              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
