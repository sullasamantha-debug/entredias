import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState } from "@/components/cozy";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Heart, Pencil, Trash2, ChevronLeft, Star, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/podcasts/$showId")({ component: ShowPage });

type Ep = {
  id: string; show_id: string; title: string; listened_date: string | null;
  duration_seconds: number | null; rating: number | null; notes: string | null; favorite: boolean;
};

const empty = () => ({ title: "", listened_date: format(new Date(), "yyyy-MM-dd"), h: 0, m: 30, s: 0, rating: 5, notes: "" });

function ShowPage() {
  const { showId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ep | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(empty());

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const sec = editing.duration_seconds ?? 0;
      setForm({
        title: editing.title,
        listened_date: editing.listened_date ?? format(new Date(), "yyyy-MM-dd"),
        h: Math.floor(sec / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60,
        rating: editing.rating ?? 5, notes: editing.notes ?? "",
      });
    } else setForm(empty());
  }, [open, editing]);

  const { data } = useQuery({
    enabled: !!user, queryKey: ["show", showId],
    queryFn: async () => {
      const [show, eps] = await Promise.all([
        supabase.from("podcast_shows").select("*").eq("id", showId).single(),
        supabase.from("podcast_episodes").select("*").eq("show_id", showId).order("listened_date", { ascending: false, nullsFirst: false }),
      ]);
      return { show: show.data, eps: (eps.data ?? []) as Ep[] };
    },
  });

  const save = async () => {
    if (!user || !form.title) return;
    const duration_seconds = form.h * 3600 + form.m * 60 + form.s;
    const payload = {
      title: form.title, listened_date: form.listened_date || null, duration_seconds,
      rating: form.rating, notes: form.notes, show_id: showId, user_id: user.id,
    };
    const { error } = editing
      ? await supabase.from("podcast_episodes").update(payload).eq("id", editing.id)
      : await supabase.from("podcast_episodes").insert(payload);
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["show", showId] });
    qc.invalidateQueries({ queryKey: ["podcast_shows"] });
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("podcast_episodes").delete().eq("id", confirmId);
    setConfirmId(null);
    qc.invalidateQueries({ queryKey: ["show", showId] });
  };

  const toggleFav = async (e: Ep) => {
    await supabase.from("podcast_episodes").update({ favorite: !e.favorite }).eq("id", e.id);
    qc.invalidateQueries({ queryKey: ["show", showId] });
  };

  const show = data?.show;
  const eps = data?.eps ?? [];
  const totalSec = eps.reduce((a, e) => a + (e.duration_seconds ?? 0), 0);
  const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  };

  return (
    <div>
      <Link to="/podcasts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Biblioteca
      </Link>

      {show && (
        <div className="cozy-card mb-6 flex gap-5 p-5">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-blush/30">
            {show.cover_url ? <img src={show.cover_url} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl">{show.name}</h1>
            <div className="mt-1 flex flex-wrap gap-1">
              {show.interest_status && (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-foreground/80">
                  {({ want: "Quero ouvir", listening: "Ouvindo", finished: "Finalizado", paused: "Pausado" } as Record<string, string>)[show.interest_status] ?? show.interest_status}
                </span>
              )}
              {show.show_status && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-foreground/80">
                  {show.show_status === "ended" ? "Encerrado" : "Em andamento"}
                </span>
              )}
            </div>
            {show.description && <p className="mt-2 text-sm text-foreground/80">{show.description}</p>}
            <div className="mt-3 flex flex-wrap gap-1">
              {(show.tags ?? []).map((t: string) => <span key={t} className="rounded-full bg-accent px-2 py-0.5 text-xs">{t}</span>)}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">{eps.length} episódios · {fmt(totalSec)} totais</div>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="self-start rounded-full"><Plus className="mr-1 h-4 w-4" />Episódio</Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar episódio" : "Novo episódio"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data ouvida</Label><Input type="date" value={form.listened_date} onChange={(e) => setForm({ ...form, listened_date: e.target.value })} /></div>
              <div><Label>Nota: {form.rating}/10</Label><input type="range" min={0} max={10} value={form.rating} onChange={(e) => setForm({ ...form, rating: +e.target.value })} className="w-full accent-[var(--primary)]" /></div>
            </div>
            <div>
              <Label>Duração (hh:mm:ss)</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input type="number" min={0} value={form.h} onChange={(e) => setForm({ ...form, h: +e.target.value })} className="w-20" />
                <span>:</span>
                <Input type="number" min={0} max={59} value={form.m} onChange={(e) => setForm({ ...form, m: +e.target.value })} className="w-20" />
                <span>:</span>
                <Input type="number" min={0} max={59} value={form.s} onChange={(e) => setForm({ ...form, s: +e.target.value })} className="w-20" />
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!eps.length ? <EmptyState title="Nenhum episódio ainda" /> : (
        <div className="space-y-2">
          {eps.map((e, i) => (
            <motion.div key={e.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="cozy-card flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{e.title}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {e.listened_date && <span>{format(new Date(e.listened_date), "dd/MM/yyyy")}</span>}
                  {e.duration_seconds ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(e.duration_seconds)}</span> : null}
                  {e.rating != null && <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{e.rating}</span>}
                </div>
                {e.notes && <p className="mt-1 text-xs text-foreground/70">{e.notes}</p>}
              </div>
              <button onClick={() => toggleFav(e)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent"><Heart className={`h-4 w-4 ${e.favorite ? "fill-[var(--blush)] text-[var(--blush)]" : "text-muted-foreground"}`} /></button>
              <button onClick={() => { setEditing(e); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => setConfirmId(e.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove}
        title="Excluir episódio?" />
    </div>
  );
}
