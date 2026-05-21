import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, EmptyState } from "@/components/cozy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BookHeart, Plus, Heart, Search } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/diario")({
  component: DiarioPage,
});

const moods = ["😢", "😕", "😐", "🙂", "😊"];

function DiarioPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<number | null>(null);

  const { data: entries } = useQuery({
    enabled: !!user,
    queryKey: ["diary", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("diary_entries").select("*").order("date", { ascending: false });
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    title: "", content: "", mood: 3, energy: 3, anxiety: 2, gratitude: "", rating: 7,
  });

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("diary_entries").insert({ ...form, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Entrada salva ✿");
    setOpen(false);
    setForm({ ...form, title: "", content: "", gratitude: "" });
    qc.invalidateQueries({ queryKey: ["diary"] });
  };

  const toggleFav = async (id: string, fav: boolean) => {
    await supabase.from("diary_entries").update({ favorite: !fav }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["diary"] });
  };

  const filtered = (entries ?? []).filter((e) => {
    const matchSearch = !search || (e.title?.toLowerCase().includes(search.toLowerCase()) || e.content?.toLowerCase().includes(search.toLowerCase()));
    const matchMood = filter == null || e.mood === filter;
    return matchSearch && matchMood;
  });

  return (
    <div>
      <PageHeader
        icon={BookHeart}
        title="Diário"
        subtitle="Um lugar suave pra registrar seus dias."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full"><Plus className="mr-1 h-4 w-4" /> Nova entrada</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="font-display text-2xl">Nova entrada</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                  <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Um dia tranquilo..." /></div>
                </div>
                <div><Label>Texto do dia</Label><Textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="O que aconteceu hoje?" /></div>
                <div><Label>Gratidão</Label><Input value={form.gratitude} onChange={(e) => setForm({ ...form, gratitude: e.target.value })} placeholder="Hoje sou grata por..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Humor</Label>
                    <div className="mt-1 flex justify-between">
                      {moods.map((m, i) => (
                        <button key={i} type="button" onClick={() => setForm({ ...form, mood: i + 1 })}
                          className={`grid h-10 w-10 place-items-center rounded-xl text-xl transition ${form.mood === i + 1 ? "bg-primary/20 scale-110" : "bg-muted hover:bg-accent"}`}>{m}</button>
                      ))}
                    </div>
                  </div>
                  <div><Label>Nota do dia (0–10): {form.rating}</Label>
                    <input type="range" min={0} max={10} value={form.rating} onChange={(e) => setForm({ ...form, rating: +e.target.value })} className="w-full accent-[var(--primary)]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Energia: {form.energy}</Label><input type="range" min={1} max={5} value={form.energy} onChange={(e) => setForm({ ...form, energy: +e.target.value })} className="w-full accent-[var(--primary)]" /></div>
                  <div><Label>Ansiedade: {form.anxiety}</Label><input type="range" min={1} max={5} value={form.anxiety} onChange={(e) => setForm({ ...form, anxiety: +e.target.value })} className="w-full accent-[var(--primary)]" /></div>
                </div>
                <Button onClick={save} className="w-full rounded-full">Salvar entrada</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar nas entradas..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setFilter(null)} className={`rounded-full px-3 py-1.5 text-xs ${filter == null ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>Todos</button>
          {moods.map((m, i) => (
            <button key={i} onClick={() => setFilter(i + 1)} className={`grid h-8 w-8 place-items-center rounded-full text-sm ${filter === i + 1 ? "bg-primary/20 scale-110" : "bg-muted"}`}>{m}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Seu diário começa aqui" description="Registre um momento, um pensamento, uma gratidão." />
      ) : (
        <div className="relative space-y-4 border-l-2 border-border pl-6">
          {filtered.map((e, idx) => (
            <motion.div key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }} className="relative">
              <div className="absolute -left-[31px] top-3 grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-primary text-[10px] text-primary-foreground">
                {moods[(e.mood ?? 3) - 1]}
              </div>
              <div className="cozy-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {format(parseISO(e.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </div>
                    {e.title && <h3 className="mt-1 font-display text-xl">{e.title}</h3>}
                  </div>
                  <button onClick={() => toggleFav(e.id, e.favorite)} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-blush-foreground">
                    <Heart className={`h-4 w-4 ${e.favorite ? "fill-[var(--blush)] text-[var(--blush)]" : ""}`} />
                  </button>
                </div>
                {e.content && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{e.content}</p>}
                {e.gratitude && <p className="mt-3 rounded-xl bg-blush/20 px-3 py-2 text-sm">✨ {e.gratitude}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {e.rating != null && <span>Nota: <b className="text-foreground">{e.rating}/10</b></span>}
                  {e.energy != null && <span>Energia: {e.energy}/5</span>}
                  {e.anxiety != null && <span>Ansiedade: {e.anxiety}/5</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
