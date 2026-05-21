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
import { Mic, Plus, Heart, Clock, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/podcasts")({ component: PodcastsPage });

function PodcastsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", episode: "", date: format(new Date(), "yyyy-MM-dd"),
    duration_min: 30, category: "", rating: 5, notes: "",
  });

  const { data: list } = useQuery({
    enabled: !!user, queryKey: ["podcasts", user?.id],
    queryFn: async () => (await supabase.from("podcasts").select("*").order("date", { ascending: false })).data ?? [],
  });

  const save = async () => {
    if (!user || !form.name) return;
    const { error } = await supabase.from("podcasts").insert({ ...form, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); qc.invalidateQueries({ queryKey: ["podcasts"] });
  };

  const toggleFav = async (id: string, fav: boolean) => {
    await supabase.from("podcasts").update({ favorite: !fav }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["podcasts"] });
  };
  const remove = async (id: string) => {
    await supabase.from("podcasts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["podcasts"] });
  };

  const totalMin = (list ?? []).reduce((s, p) => s + (p.duration_min ?? 0), 0);
  const counts = (list ?? []).reduce<Record<string, number>>((acc, p) => { acc[p.name] = (acc[p.name] ?? 0) + 1; return acc; }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <PageHeader icon={Mic} title="Podcasts" subtitle="O que sua mente escutou."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="rounded-full"><Plus className="mr-1 h-4 w-4" />Adicionar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Novo podcast</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Podcast</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Episódio</Label><Input value={form.episode} onChange={(e) => setForm({ ...form, episode: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                  <div><Label>Duração (min)</Label><Input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: +e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                  <div><Label>Nota: {form.rating}/10</Label><input type="range" min={0} max={10} value={form.rating} onChange={(e) => setForm({ ...form, rating: +e.target.value })} className="w-full accent-[var(--primary)]" /></div>
                </div>
                <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button className="w-full rounded-full" onClick={save}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Episódios" value={list?.length ?? 0} icon={Mic} />
        <StatCard label="Tempo total" value={`${Math.round(totalMin / 60)}h`} icon={Clock} tint="blush" />
        <StatCard label="Mais ouvido" value={top?.[0]?.slice(0, 14) ?? "—"} hint={top ? `${top[1]} eps` : ""} tint="mint" />
        <StatCard label="Favoritos" value={(list ?? []).filter((p) => p.favorite).length} icon={Heart} tint="sand" />
      </div>

      {!list?.length ? <EmptyState title="Sem episódios ainda" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="cozy-card p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-display text-lg truncate">{p.name}</div>
                  {p.episode && <div className="text-sm text-muted-foreground truncate">{p.episode}</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {p.date && <span>{format(new Date(p.date), "dd/MM/yyyy")}</span>}
                    {p.duration_min ? <span>· {p.duration_min}min</span> : null}
                    {p.category && <span className="rounded-full bg-accent px-2 py-0.5">{p.category}</span>}
                    {p.rating != null && <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{p.rating}</span>}
                  </div>
                  {p.notes && <p className="mt-2 text-sm text-foreground/80">{p.notes}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => toggleFav(p.id, p.favorite)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent">
                    <Heart className={`h-4 w-4 ${p.favorite ? "fill-[var(--blush)] text-[var(--blush)]" : "text-muted-foreground"}`} />
                  </button>
                  <button onClick={() => remove(p.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
