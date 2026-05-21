import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, EmptyState } from "@/components/cozy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Cake, Plus, Trash2, Gift } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, addYears, differenceInCalendarDays, isAfter, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/aniversarios")({ component: AniversariosPage });

const CATS = ["família", "amigos", "trabalho", "outros"] as const;

function AniversariosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "amigos", date: "", notes: "", gift_ideas: "" });

  const { data: list } = useQuery({
    enabled: !!user, queryKey: ["birthdays", user?.id],
    queryFn: async () => (await supabase.from("birthdays").select("*")).data ?? [],
  });

  const save = async () => {
    if (!user || !form.name || !form.date) return;
    const { error } = await supabase.from("birthdays").insert({ ...form, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setForm({ name: "", category: "amigos", date: "", notes: "", gift_ideas: "" });
    qc.invalidateQueries({ queryKey: ["birthdays"] });
  };
  const remove = async (id: string) => { await supabase.from("birthdays").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["birthdays"] }); };

  const today = new Date();
  const enriched = (list ?? [])
    .map((b) => {
      const d = parseISO(b.date);
      let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
      if (!isAfter(next, subDays(today, 1))) next = addYears(next, 1);
      return { ...b, next, daysAway: differenceInCalendarDays(next, today), age: today.getFullYear() - d.getFullYear() };
    })
    .sort((a, b) => a.daysAway - b.daysAway);

  const todayBdays = enriched.filter((b) => b.daysAway === 0);

  return (
    <div>
      <PageHeader icon={Cake} title="Aniversários" subtitle="Para nunca esquecer quem te importa."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="rounded-full"><Plus className="mr-1 h-4 w-4" />Adicionar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Novo aniversário</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                  <div><Label>Categoria</Label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div><Label>Ideias de presente</Label><Textarea value={form.gift_ideas} onChange={(e) => setForm({ ...form, gift_ideas: e.target.value })} /></div>
                <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button onClick={save} className="w-full rounded-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {todayBdays.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="cozy-card mb-6 bg-blush/30 p-5">
          <div className="flex items-center gap-2 font-display text-lg">🎂 Aniversariante{todayBdays.length > 1 ? "s" : ""} do dia</div>
          <div className="mt-2">{todayBdays.map((b) => b.name).join(", ")}</div>
        </motion.div>
      )}

      {!enriched.length ? <EmptyState title="Adicione os aniversários importantes" /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {enriched.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="cozy-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{b.category}</div>
                  <div className="font-display text-xl">{b.name}</div>
                  <div className="mt-1 text-sm text-primary">
                    {b.daysAway === 0 ? "🎉 Hoje!" : `em ${b.daysAway} dia${b.daysAway === 1 ? "" : "s"}`}
                  </div>
                  <div className="text-xs text-muted-foreground">{format(b.next, "d 'de' MMMM", { locale: ptBR })} · {b.age} anos</div>
                </div>
                <button onClick={() => remove(b.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              {b.gift_ideas && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-mint/30 p-3 text-xs">
                  <Gift className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{b.gift_ideas}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
