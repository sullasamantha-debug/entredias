import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, EmptyState, StatCard } from "@/components/cozy";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TagInput, TagBadges } from "@/components/TagInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic, Plus, Heart, Clock, Trash2, Pencil, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/podcasts/")({ component: PodcastsPage });

type Show = {
  id: string; name: string; description: string | null; platform: string | null;
  cover_url: string | null; tags: string[] | null; favorite: boolean;
};
type Ep = { id: string; show_id: string; duration_seconds: number | null; listened_date: string | null; title: string; favorite: boolean };


const empty = () => ({ name: "", description: "", platform: "", cover_url: "", tags: [] as string[] });

function fmtDur(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function PodcastsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Show | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"library" | "favorites">("library");
  const [form, setForm] = useState(empty());


  useEffect(() => {
    if (!open) return;
    setForm(editing
      ? { name: editing.name, description: editing.description ?? "", platform: editing.platform ?? "", cover_url: editing.cover_url ?? "", tags: editing.tags ?? [] }
      : empty());
  }, [open, editing]);

  const { data } = useQuery({
    enabled: !!user, queryKey: ["podcast_shows", user?.id],
    queryFn: async () => {
      const [shows, eps] = await Promise.all([
        supabase.from("podcast_shows").select("*").order("created_at", { ascending: false }),
        supabase.from("podcast_episodes").select("id,show_id,duration_seconds,listened_date,title,favorite").order("listened_date", { ascending: false }),
      ]);
      return { shows: (shows.data ?? []) as Show[], eps: (eps.data ?? []) as Ep[] };
    },
  });

  const save = async () => {
    if (!user || !form.name) return;
    const payload = { ...form, user_id: user.id };
    const { error } = editing
      ? await supabase.from("podcast_shows").update(payload).eq("id", editing.id)
      : await supabase.from("podcast_shows").insert(payload);
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["podcast_shows"] });
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("podcast_shows").delete().eq("id", confirmId);
    setConfirmId(null);
    qc.invalidateQueries({ queryKey: ["podcast_shows"] });
  };

  const toggleFav = async (s: Show) => {
    await supabase.from("podcast_shows").update({ favorite: !s.favorite }).eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["podcast_shows"] });
  };

  const shows = data?.shows ?? [];
  const eps = data?.eps ?? [];
  const filtered = shows.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase())));
  const totalSec = eps.reduce((a, e) => a + (e.duration_seconds ?? 0), 0);

  return (
    <div>
      <PageHeader icon={Mic} title="Podcasts" subtitle="Sua biblioteca de escuta."
        action={<Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Novo podcast</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar podcast" : "Novo podcast"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Plataforma</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Spotify…" /></div>
              <div><Label>Capa (URL)</Label><Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></div>
            </div>
            <div><Label>Tags</Label><TagInput value={form.tags} onChange={(t) => setForm({ ...form, tags: t })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Podcasts" value={shows.length} icon={Mic} />
        <StatCard label="Episódios" value={eps.length} tint="blush" />
        <StatCard label="Tempo total" value={fmtDur(totalSec)} icon={Clock} tint="mint" />
        <StatCard label="Favoritos" value={shows.filter((s) => s.favorite).length} icon={Heart} tint="sand" />
      </div>

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar podcast ou tag…" className="pl-9 rounded-full" />
      </div>

      {!filtered.length ? (
        <EmptyState title="Sua biblioteca está vazia" description="Adicione o primeiro podcast." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s, i) => {
            const my = eps.filter((e) => e.show_id === s.id);
            const sec = my.reduce((a, e) => a + (e.duration_seconds ?? 0), 0);
            const last = my[0];
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="cozy-card overflow-hidden">
                <Link to="/podcasts/$showId" params={{ showId: s.id }} className="block">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-primary/20 to-blush/30">
                    {s.cover_url ? (
                      <img src={s.cover_url} alt={s.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center">
                        <Mic className="h-12 w-12 text-primary/40" />
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link to="/podcasts/$showId" params={{ showId: s.id }} className="min-w-0 flex-1">
                      <div className="font-display text-lg truncate">{s.name}</div>
                      {s.platform && <div className="text-xs text-muted-foreground">{s.platform}</div>}
                    </Link>
                    <div className="flex gap-0.5">
                      <button onClick={() => toggleFav(s)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent">
                        <Heart className={`h-4 w-4 ${s.favorite ? "fill-[var(--blush)] text-[var(--blush)]" : "text-muted-foreground"}`} />
                      </button>
                      <button onClick={() => { setEditing(s); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setConfirmId(s.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="mt-2"><TagBadges tags={s.tags} /></div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{my.length} ep · {fmtDur(sec)}</span>
                    {last && <span className="truncate ml-2">último: {last.title}</span>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove}
        title="Excluir podcast?" description="Todos os episódios vinculados serão removidos." />
    </div>
  );
}
