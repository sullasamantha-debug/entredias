import { createFileRoute } from "@tanstack/react-router";
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
import { BookOpen, Plus, Trash2, Star, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/livros")({ component: LivrosPage });

const STATUS = ["lendo", "concluido", "abandonado", "quero-ler"] as const;

type Book = {
  id: string; title: string; author: string | null; category: string | null;
  start_date: string | null; end_date: string | null; rating: number | null;
  status: string | null; pages: number | null; quotes: string | null;
  review: string | null; tags: string[] | null;
};

const empty = () => ({
  title: "", author: "", category: "", start_date: "", end_date: "",
  rating: 8, status: "lendo", pages: 300, quotes: "", review: "", tags: [] as string[],
});

function LivrosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(empty());

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      title: editing.title, author: editing.author ?? "", category: editing.category ?? "",
      start_date: editing.start_date ?? "", end_date: editing.end_date ?? "",
      rating: editing.rating ?? 8, status: editing.status ?? "lendo",
      pages: editing.pages ?? 300, quotes: editing.quotes ?? "",
      review: editing.review ?? "", tags: editing.tags ?? [],
    } : empty());
  }, [open, editing]);

  const { data: list } = useQuery({
    enabled: !!user, queryKey: ["books", user?.id],
    queryFn: async () => ((await supabase.from("books").select("*").order("created_at", { ascending: false })).data ?? []) as Book[],
  });

  const save = async () => {
    if (!user || !form.title) return;
    const payload = { ...form, start_date: form.start_date || null, end_date: form.end_date || null, user_id: user.id };
    const { error } = editing
      ? await supabase.from("books").update(payload).eq("id", editing.id)
      : await supabase.from("books").insert(payload);
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["books"] });
  };
  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("books").delete().eq("id", confirmId);
    setConfirmId(null);
    qc.invalidateQueries({ queryKey: ["books"] });
  };

  const concluidos = (list ?? []).filter((b) => b.status === "concluido");
  const totalPaginas = concluidos.reduce((s, b) => s + (b.pages ?? 0), 0);
  const ratings = (list ?? []).filter((b) => b.rating != null).map((b) => b.rating!);
  const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";

  return (
    <div>
      <PageHeader icon={BookOpen} title="Livros" subtitle="Páginas que te atravessam."
        action={<Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Adicionar</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar livro" : "Novo livro"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Autor</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>Páginas</Label><Input type="number" value={form.pages} onChange={(e) => setForm({ ...form, pages: +e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Conclusão</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><Label>Nota: {form.rating}/10</Label><input type="range" min={0} max={10} value={form.rating} onChange={(e) => setForm({ ...form, rating: +e.target.value })} className="w-full accent-[var(--primary)]" /></div>
            </div>
            <div><Label>Tags</Label><TagInput value={form.tags} onChange={(tags) => setForm({ ...form, tags })} /></div>
            <div><Label>Frases favoritas</Label><Textarea value={form.quotes} onChange={(e) => setForm({ ...form, quotes: e.target.value })} /></div>
            <div><Label>Review</Label><Textarea value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Concluídos" value={concluidos.length} icon={BookOpen} />
        <StatCard label="Páginas lidas" value={totalPaginas} tint="blush" />
        <StatCard label="Nota média" value={avg} tint="mint" />
        <StatCard label="Lendo agora" value={(list ?? []).filter((b) => b.status === "lendo").length} tint="sand" />
      </div>

      {!list?.length ? <EmptyState title="Sua estante está vazia" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="cozy-card flex gap-4 p-4">
              <div className="grid h-24 w-16 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blush/60 to-primary/30 font-display text-xl text-foreground/70">
                {b.title.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg leading-tight">{b.title}</div>
                {b.author && <div className="text-sm text-muted-foreground">{b.author}</div>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className={`rounded-full px-2 py-0.5 ${
                    b.status === "concluido" ? "bg-mint/50" : b.status === "lendo" ? "bg-primary/15" : "bg-muted"
                  }`}>{b.status}</span>
                  {b.category && <span>· {b.category}</span>}
                  {b.pages != null && <span>· {b.pages}p</span>}
                  {b.rating != null && <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{b.rating}</span>}
                </div>
                <div className="mt-2"><TagBadges tags={b.tags} /></div>
                {b.quotes && <p className="mt-2 rounded-lg border-l-2 border-blush bg-blush/10 p-2 text-xs italic text-foreground/80 line-clamp-2">"{b.quotes}"</p>}
              </div>
              <div className="flex flex-col gap-1 self-start">
                <button onClick={() => { setEditing(b); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setConfirmId(b.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove} title="Excluir livro?" />
    </div>
  );
}
