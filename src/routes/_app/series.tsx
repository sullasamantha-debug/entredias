import { createFileRoute } from "@tanstack/react-router";
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
import { Tv, Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/series")({ component: SeriesPage });

const STATUS = ["assistindo", "pausada", "finalizada"] as const;

function SeriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", platform: "Netflix", season: 1, episodes_watched: 0, total_episodes: 10,
    status: "assistindo", rating: 8, review: "",
  });

  const { data: list } = useQuery({
    enabled: !!user, queryKey: ["series", user?.id],
    queryFn: async () => (await supabase.from("series").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const save = async () => {
    if (!user || !form.name) return;
    const { error } = await supabase.from("series").insert({ ...form, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); qc.invalidateQueries({ queryKey: ["series"] });
  };
  const remove = async (id: string) => { await supabase.from("series").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["series"] }); };
  const updateEps = async (id: string, eps: number) => {
    await supabase.from("series").update({ episodes_watched: eps }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["series"] });
  };

  const finalizadas = (list ?? []).filter((s) => s.status === "finalizada").length;
  const totalEps = (list ?? []).reduce((s, x) => s + (x.episodes_watched ?? 0), 0);
  const platforms = (list ?? []).reduce<Record<string, number>>((a, s) => { if (s.platform) a[s.platform] = (a[s.platform] ?? 0) + 1; return a; }, {});
  const topPlat = Object.entries(platforms).sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <PageHeader icon={Tv} title="Séries" subtitle="Maratonas e cliffhangers."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="rounded-full"><Plus className="mr-1 h-4 w-4" />Adicionar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Nova série</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Plataforma</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} /></div>
                  <div><Label>Temporada</Label><Input type="number" value={form.season} onChange={(e) => setForm({ ...form, season: +e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Episódios vistos</Label><Input type="number" value={form.episodes_watched} onChange={(e) => setForm({ ...form, episodes_watched: +e.target.value })} /></div>
                  <div><Label>Total episódios</Label><Input type="number" value={form.total_episodes} onChange={(e) => setForm({ ...form, total_episodes: +e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Status</Label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><Label>Nota: {form.rating}/10</Label><input type="range" min={0} max={10} value={form.rating} onChange={(e) => setForm({ ...form, rating: +e.target.value })} className="w-full accent-[var(--primary)]" /></div>
                </div>
                <div><Label>Review</Label><Textarea value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} /></div>
                <Button onClick={save} className="w-full rounded-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total séries" value={list?.length ?? 0} icon={Tv} />
        <StatCard label="Finalizadas" value={finalizadas} tint="mint" />
        <StatCard label="Episódios" value={totalEps} tint="blush" />
        <StatCard label="Top plataforma" value={topPlat?.[0] ?? "—"} hint={topPlat ? `${topPlat[1]} séries` : ""} tint="sand" />
      </div>

      {!list?.length ? <EmptyState title="Sua próxima maratona começa aqui" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((s, i) => {
            const pct = s.total_episodes ? Math.min(100, ((s.episodes_watched ?? 0) / s.total_episodes) * 100) : 0;
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="cozy-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg truncate">{s.name}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {s.platform && <span className="rounded-full bg-accent px-2 py-0.5">{s.platform}</span>}
                      {s.season != null && <span>T{s.season}</span>}
                      <span className={`rounded-full px-2 py-0.5 ${
                        s.status === "finalizada" ? "bg-mint/50" : s.status === "pausada" ? "bg-sand/60" : "bg-primary/15"
                      }`}>{s.status}</span>
                      {s.rating != null && <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{s.rating}</span>}
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{s.episodes_watched ?? 0} / {s.total_episodes ?? "?"} eps</span>
                        <span>{Math.round(pct)}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-2 flex gap-1">
                        <button onClick={() => updateEps(s.id, Math.max(0, (s.episodes_watched ?? 0) - 1))} className="rounded-lg border border-border px-2 text-sm hover:bg-accent">−</button>
                        <button onClick={() => updateEps(s.id, (s.episodes_watched ?? 0) + 1)} className="rounded-lg border border-border px-2 text-sm hover:bg-accent">+1 ep</button>
                      </div>
                    </div>
                    {s.review && <p className="mt-3 text-sm text-foreground/80 line-clamp-3">{s.review}</p>}
                  </div>
                  <button onClick={() => remove(s.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
