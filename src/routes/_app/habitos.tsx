import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, EmptyState } from "@/components/cozy";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Plus, Flame, Check, Trash2, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  format, subDays, eachDayOfInterval, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isSameDay, isAfter, startOfYear, endOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnly } from "@/lib/dates";

export const Route = createFileRoute("/_app/habitos")({ component: HabitosPage });

const COLORS = ["#7dd3fc", "#fda4af", "#86efac", "#fcd34d", "#c4b5fd", "#fdba74", "#f0abfc", "#a3e635"];
const empty = () => ({ name: "", color: COLORS[0] });

type Habit = { id: string; name: string; color: string | null; archived: boolean; created_at: string };
type Log = { id: string; habit_id: string; date: string; done: boolean };

function HabitosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(empty());
  const [cursor, setCursor] = useState(new Date());
  const today = new Date();

  useEffect(() => {
    if (!open) return;
    setForm(editing ? { name: editing.name, color: editing.color ?? COLORS[0] } : empty());
  }, [open, editing]);

  const { data } = useQuery({
    enabled: !!user, queryKey: ["habits", user?.id],
    queryFn: async () => {
      const [h, logs] = await Promise.all([
        supabase.from("habits").select("*").eq("archived", false).order("created_at"),
        supabase.from("habit_logs").select("*"),
      ]);
      return { habits: (h.data ?? []) as Habit[], logs: (logs.data ?? []) as Log[] };
    },
  });

  const save = async () => {
    if (!user || !form.name) return;
    const { error } = editing
      ? await supabase.from("habits").update({ name: form.name, color: form.color }).eq("id", editing.id)
      : await supabase.from("habits").insert({ name: form.name, color: form.color, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["habits"] });
  };

  const toggle = async (habitId: string, date: string) => {
    if (!user || !data) return;
    if (isAfter(parseDateOnly(date), today)) return;
    const existing = data.logs.find((l) => l.habit_id === habitId && l.date === date);
    if (existing) await supabase.from("habit_logs").delete().eq("id", existing.id);
    else await supabase.from("habit_logs").insert({ habit_id: habitId, date, user_id: user.id, done: true });
    qc.invalidateQueries({ queryKey: ["habits"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("habits").update({ archived: true }).eq("id", confirmId);
    setConfirmId(null);
    qc.invalidateQueries({ queryKey: ["habits"] });
  };

  const grid = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
  }), [cursor]);

  const streakFor = (habitId: string) => {
    if (!data) return 0;
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const d = format(subDays(today, i), "yyyy-MM-dd");
      if (data.logs.some((l) => l.habit_id === habitId && l.date === d && l.done)) s++;
      else if (i > 0) break;
    }
    return s;
  };
  const monthPct = (habitId: string) => {
    if (!data) return 0;
    const m = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
    const done = m.filter((d) => data.logs.some((l) => l.habit_id === habitId && l.date === format(d, "yyyy-MM-dd") && l.done)).length;
    return Math.round((done / m.length) * 100);
  };

  const yearDays = useMemo(() => eachDayOfInterval({ start: startOfYear(cursor), end: endOfYear(cursor) }), [cursor]);

  return (
    <div>
      <PageHeader icon={Activity} title="Hábitos" subtitle="Pequenos rituais, histórico contínuo."
        action={<Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" /> Novo hábito</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar hábito" : "Novo hábito"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Beber água" /></div>
            <div>
              <Label>Cor</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                    className={`h-8 w-8 rounded-full border-2 ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Criar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(subMonths(cursor, 1))} className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
          <span className="font-display text-xl capitalize min-w-[160px] text-center">{format(cursor, "MMMM yyyy", { locale: ptBR })}</span>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => setCursor(new Date())} className="ml-1 rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-accent">Hoje</button>
        </div>
        <div className="text-xs text-muted-foreground hidden md:block">Clique em qualquer dia para marcar (retroativo)</div>
      </div>

      {!data?.habits.length ? (
        <EmptyState title="Crie seu primeiro hábito" description="Beber água, dormir cedo, ler 10 min..." />
      ) : (
        <div className="space-y-5">
          {data.habits.map((h, i) => {
            const streak = streakFor(h.id);
            const pct = monthPct(h.id);
            const color = h.color ?? "#7dd3fc";
            return (
              <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="cozy-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl shadow-sm" style={{ background: color }} />
                    <div>
                      <div className="font-display text-lg">{h.name}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-blush-foreground" /> {streak}d streak</span>
                        <span>{format(cursor, "MMM", { locale: ptBR })}: {pct}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(h); setOpen(true); }} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setConfirmId(h.id)} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                    {["dom","seg","ter","qua","qui","sex","sab"].map((d) => <div key={d}>{d}</div>)}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {grid.map((d) => {
                      const k = format(d, "yyyy-MM-dd");
                      const inMonth = isSameMonth(d, cursor);
                      const future = isAfter(d, today);
                      const isToday = isSameDay(d, today);
                      const done = data.logs.some((l) => l.habit_id === h.id && l.date === k && l.done);
                      return (
                        <button key={k} disabled={future} onClick={() => toggle(h.id, k)}
                          className={`group relative aspect-square rounded-xl border text-xs transition ${
                            done ? "border-transparent text-white" : "border-border hover:border-primary"
                          } ${!inMonth ? "opacity-30" : ""} ${future ? "cursor-not-allowed opacity-30" : ""}`}
                          style={done ? { background: color } : undefined}>
                          <span className={`font-display ${isToday && !done ? "text-primary font-bold" : ""}`}>{format(d, "d")}</span>
                          {done && <Check className="absolute right-1 top-1 h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <details className="mt-4">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Heatmap anual — {format(cursor, "yyyy")}</summary>
                  <div className="mt-3 flex flex-wrap gap-[2px]">
                    {yearDays.map((d) => {
                      const k = format(d, "yyyy-MM-dd");
                      const done = data.logs.some((l) => l.habit_id === h.id && l.date === k && l.done);
                      return (
                        <div key={k} title={k} className="h-3 w-3 rounded-sm"
                          style={{ background: done ? color : "var(--muted)" }} />
                      );
                    })}
                  </div>
                </details>
              </motion.div>
            );
          })}
        </div>
      )}

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove}
        title="Arquivar hábito?" description="O hábito sairá da lista. Seu histórico será preservado." />
    </div>
  );
}
