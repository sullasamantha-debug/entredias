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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Activity, Plus, Flame, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, eachDayOfInterval } from "date-fns";

export const Route = createFileRoute("/_app/habitos")({ component: HabitosPage });

const COLORS = ["#7dd3fc", "#fda4af", "#86efac", "#fcd34d", "#c4b5fd", "#fdba74"];

function HabitosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", color: COLORS[0] });
  const today = new Date();
  const days = eachDayOfInterval({ start: subDays(today, 13), end: today });

  const { data } = useQuery({
    enabled: !!user,
    queryKey: ["habits", user?.id],
    queryFn: async () => {
      const [h, logs] = await Promise.all([
        supabase.from("habits").select("*").eq("archived", false).order("created_at"),
        supabase.from("habit_logs").select("*").gte("date", format(subDays(today, 365), "yyyy-MM-dd")),
      ]);
      return { habits: h.data ?? [], logs: logs.data ?? [] };
    },
  });

  const create = async () => {
    if (!user || !form.name) return;
    const { error } = await supabase.from("habits").insert({ name: form.name, color: form.color, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setForm({ name: "", color: COLORS[0] });
    qc.invalidateQueries({ queryKey: ["habits"] });
  };

  const toggle = async (habitId: string, date: string) => {
    if (!user || !data) return;
    const existing = data.logs.find((l) => l.habit_id === habitId && l.date === date);
    if (existing) {
      await supabase.from("habit_logs").delete().eq("id", existing.id);
    } else {
      await supabase.from("habit_logs").insert({ habit_id: habitId, date, user_id: user.id, done: true });
    }
    qc.invalidateQueries({ queryKey: ["habits"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const removeHabit = async (id: string) => {
    await supabase.from("habits").update({ archived: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["habits"] });
  };

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
    const last30 = eachDayOfInterval({ start: subDays(today, 29), end: today });
    const done = last30.filter((d) => data.logs.some((l) => l.habit_id === habitId && l.date === format(d, "yyyy-MM-dd") && l.done)).length;
    return Math.round((done / 30) * 100);
  };

  return (
    <div>
      <PageHeader
        icon={Activity}
        title="Hábitos"
        subtitle="Pequenos rituais, grandes mudanças."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="rounded-full"><Plus className="mr-1 h-4 w-4" /> Novo hábito</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Novo hábito</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Beber água" /></div>
                <div>
                  <Label>Cor</Label>
                  <div className="mt-1 flex gap-2">
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => setForm({ ...form, color: c })}
                        className={`h-8 w-8 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <Button onClick={create} className="w-full rounded-full">Adicionar</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {!data?.habits.length ? (
        <EmptyState title="Crie seu primeiro hábito" description="Beber água, dormir cedo, ler 10min..." />
      ) : (
        <div className="space-y-4">
          {data.habits.map((h, i) => {
            const streak = streakFor(h.id);
            const pct = monthPct(h.id);
            return (
              <motion.div key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="cozy-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl" style={{ background: h.color ?? "#7dd3fc" }} />
                    <div>
                      <div className="font-display text-lg">{h.name}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-blush-foreground" /> streak {streak}d</span>
                        <span>30d: {pct}%</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeHabit(h.id)} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-7 gap-1.5 md:grid-cols-14">
                  {days.map((d) => {
                    const k = format(d, "yyyy-MM-dd");
                    const done = data.logs.some((l) => l.habit_id === h.id && l.date === k && l.done);
                    return (
                      <button key={k} onClick={() => toggle(h.id, k)}
                        className={`group flex aspect-square flex-col items-center justify-center rounded-xl border text-[10px] transition ${
                          done ? "border-transparent text-white" : "border-border text-muted-foreground hover:border-primary"
                        }`}
                        style={done ? { background: h.color ?? "#7dd3fc" } : undefined}
                        title={k}>
                        <span>{format(d, "EEEEE")}</span>
                        <span className="font-display text-sm leading-none">{format(d, "d")}</span>
                        {done && <Check className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
