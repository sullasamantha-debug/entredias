import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, EmptyState } from "@/components/cozy";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookHeart, Plus, Heart, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateOnly, localDateKey } from "@/lib/dates";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/diario")({ component: DiarioPage });

const moods = ["😢", "😕", "😐", "🙂", "😊"];

type Entry = {
  id: string; date: string; content: string | null; mood: number | null;
  rating: number | null; favorite: boolean; title: string | null;
};

const empty = () => ({ date: localDateKey(), content: "", mood: 3, rating: 7 });

function DiarioPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<number | null>(null);
  const [form, setForm] = useState(empty());

  const { data: entries } = useQuery({
    enabled: !!user, queryKey: ["diary", user?.id],
    queryFn: async () => ((await supabase.from("diary_entries").select("*").order("date", { ascending: false })).data ?? []) as Entry[],
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        date: editing.date,
        content: editing.content ?? "",
        mood: editing.mood ?? 3,
        rating: editing.rating ?? 7,
      });
    } else {
      setForm(empty());
    }
  }, [open, editing]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (e: Entry) => { setEditing(e); setOpen(true); };

  const save = async () => {
    if (!user) return;
    const payload = { ...form, user_id: user.id };
    const { error } = editing
      ? await supabase.from("diary_entries").update(payload).eq("id", editing.id)
      : await supabase.from("diary_entries").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Entrada atualizada" : "Entrada salva ✿");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["diary"] });
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("diary_entries").delete().eq("id", confirmId);
    setConfirmId(null);
    qc.invalidateQueries({ queryKey: ["diary"] });
  };

  const toggleFav = async (id: string, fav: boolean) => {
    await supabase.from("diary_entries").update({ favorite: !fav }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["diary"] });
  };

  const filtered = (entries ?? []).filter((e) => {
    const m = !search || e.content?.toLowerCase().includes(search.toLowerCase());
    const mm = filter == null || e.mood === filter;
    return m && mm;
  });

  return (
    <div>
      <PageHeader icon={BookHeart} title="Diário" subtitle="Um registro suave dos seus dias."
        action={<Button onClick={openNew} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Nova entrada</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar entrada" : "Novo dia"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Humor do dia</Label>
              <div className="mt-2 flex gap-2">
                {moods.map((m, i) => (
                  <button key={i} type="button" onClick={() => setForm({ ...form, mood: i })}
                    className={`grid h-12 w-12 place-items-center rounded-2xl border text-2xl transition ${
                      form.mood === i ? "border-primary bg-primary/15 scale-110" : "border-border hover:bg-accent"
                    }`}>{m}</button>
                ))}
              </div>
            </div>
            <div>
              <Label>O que aconteceu hoje?</Label>
              <Textarea rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Conte como foi o seu dia…" />
            </div>
            <div>
              <Label>Nota do dia: <span className="font-display text-base text-primary">{form.rating}/10</span></Label>
              <input type="range" min={0} max={10} value={form.rating} onChange={(e) => setForm({ ...form, rating: +e.target.value })} className="w-full accent-[var(--primary)]" />
            </div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar alterações" : "Salvar entrada"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no diário…" className="pl-9 rounded-full" />
        </div>
        <div className="flex gap-1">
          <button onClick={() => setFilter(null)} className={`grid h-10 w-10 place-items-center rounded-full border text-sm ${filter == null ? "bg-primary/15 border-primary" : "border-border"}`}>·</button>
          {moods.map((m, i) => (
            <button key={i} onClick={() => setFilter(i)} className={`grid h-10 w-10 place-items-center rounded-full border text-lg ${filter === i ? "bg-primary/15 border-primary" : "border-border"}`}>{m}</button>
          ))}
        </div>
      </div>

      {!filtered.length ? (
        <EmptyState title="Nenhum registro" description="Escreva sobre o seu dia para começar." />
      ) : (
        <div className="relative space-y-4 border-l-2 border-border pl-6 ml-3">
          {filtered.map((e, i) => (
            <motion.div key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="relative">
              <div className="absolute -left-[34px] grid h-10 w-10 place-items-center rounded-full bg-card border-2 border-primary/30 text-xl shadow-sm">
                {moods[e.mood ?? 3]}
              </div>
              <div className="cozy-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {formatDateOnly(e.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </div>
                    {e.content && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{e.content}</p>}
                    {e.rating != null && (
                      <div className="mt-3 text-xs text-muted-foreground">Nota do dia: <span className="text-foreground font-medium">{e.rating}/10</span></div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => toggleFav(e.id, e.favorite)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent">
                      <Heart className={`h-4 w-4 ${e.favorite ? "fill-[var(--blush)] text-[var(--blush)]" : "text-muted-foreground"}`} />
                    </button>
                    <button onClick={() => openEdit(e)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setConfirmId(e.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove}
        title="Excluir entrada?" description="A entrada do diário será removida permanentemente." />
    </div>
  );
}
