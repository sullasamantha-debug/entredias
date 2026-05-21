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
import { Film, Plus, Heart, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/filmes")({ component: FilmesPage });

function FilmesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", watched_date: format(new Date(), "yyyy-MM-dd"),
    rating: 8, platform: "", genre: "", review: "",
  });

  const { data: list } = useQuery({
    enabled: !!user, queryKey: ["movies", user?.id],
    queryFn: async () => (await supabase.from("movies").select("*").order("watched_date", { ascending: false, nullsFirst: false })).data ?? [],
  });

  const save = async () => {
    if (!user || !form.name) return;
    const { error } = await supabase.from("movies").insert({ ...form, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); qc.invalidateQueries({ queryKey: ["movies"] });
  };
  const remove = async (id: string) => { await supabase.from("movies").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["movies"] }); };
  const toggleFav = async (id: string, fav: boolean) => { await supabase.from("movies").update({ favorite: !fav }).eq("id", id); qc.invalidateQueries({ queryKey: ["movies"] }); };

  const ratings = (list ?? []).filter((m) => m.rating != null).map((m) => m.rating!);
  const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";
  const genres = (list ?? []).reduce<Record<string, number>>((acc, m) => { if (m.genre) acc[m.genre] = (acc[m.genre] ?? 0) + 1; return acc; }, {});
  const topGenre = Object.entries(genres).sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <PageHeader icon={Film} title="Filmes" subtitle="Sua filmoteca pessoal."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="rounded-full"><Plus className="mr-1 h-4 w-4" />Adicionar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Novo filme</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Data assistida</Label><Input type="date" value={form.watched_date} onChange={(e) => setForm({ ...form, watched_date: e.target.value })} /></div>
                  <div><Label>Plataforma</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Gênero</Label><Input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} /></div>
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
        <StatCard label="Total" value={list?.length ?? 0} icon={Film} />
        <StatCard label="Nota média" value={avg} tint="blush" />
        <StatCard label="Favoritos" value={(list ?? []).filter((m) => m.favorite).length} icon={Heart} tint="mint" />
        <StatCard label="Top gênero" value={topGenre?.[0] ?? "—"} tint="sand" />
      </div>

      {!list?.length ? <EmptyState title="Adicione o primeiro filme" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="cozy-card p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg leading-snug">{m.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {m.watched_date && <span>{format(new Date(m.watched_date), "dd/MM/yy")}</span>}
                    {m.platform && <span className="rounded-full bg-accent px-2 py-0.5">{m.platform}</span>}
                    {m.genre && <span>· {m.genre}</span>}
                  </div>
                  {m.rating != null && (
                    <div className="mt-2 flex items-center gap-0.5">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className={`h-3.5 w-3.5 ${j < Math.round((m.rating! / 10) * 5) ? "fill-yellow-400 text-yellow-400" : "text-muted"}`} />
                      ))}
                      <span className="ml-1 text-xs text-muted-foreground">{m.rating}/10</span>
                    </div>
                  )}
                  {m.review && <p className="mt-2 text-sm text-foreground/80 line-clamp-3">{m.review}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => toggleFav(m.id, m.favorite)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent">
                    <Heart className={`h-4 w-4 ${m.favorite ? "fill-[var(--blush)] text-[var(--blush)]" : "text-muted-foreground"}`} />
                  </button>
                  <button onClick={() => remove(m.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
