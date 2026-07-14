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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalIcon, Plus, ChevronLeft, ChevronRight, Trash2, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  isSameDay, isSameMonth, startOfWeek, endOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDateBR, localDateKey, parseDateOnly } from "@/lib/dates";

export const Route = createFileRoute("/_app/agenda")({ component: AgendaPage });

const TYPES = ["evento", "compromisso", "meta", "lembrete"] as const;

type Ev = { id: string; title: string; date: string; time_str: string | null; type: string | null; description: string | null; completed: boolean };

const empty = (date?: string) => ({
  title: "", date: date ?? localDateKey(), time_str: "", type: "evento", description: "",
});

function AgendaPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ev | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(null);
  const [form, setForm] = useState(empty());

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      title: editing.title, date: editing.date, time_str: editing.time_str ?? "",
      type: editing.type ?? "evento", description: editing.description ?? "",
    } : empty(selected ? localDateKey(selected) : undefined));
  }, [open, editing, selected]);

  const { data: events } = useQuery({
    enabled: !!user, queryKey: ["events", user?.id],
    queryFn: async () => ((await supabase.from("events").select("*").order("date")).data ?? []) as Ev[],
  });

  const save = async () => {
    if (!user || !form.title) return;
    const { error } = editing
      ? await supabase.from("events").update(form).eq("id", editing.id)
      : await supabase.from("events").insert({ ...form, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["events"] }); qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("events").delete().eq("id", confirmId);
    setConfirmId(null);
    qc.invalidateQueries({ queryKey: ["events"] });
  };
  const toggleDone = async (id: string, c: boolean) => { await supabase.from("events").update({ completed: !c }).eq("id", id); qc.invalidateQueries({ queryKey: ["events"] }); };

  const grid = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const activeEvents = (events ?? []).filter((e) => !e.completed);
  const completedEvents = (events ?? []).filter((e) => e.completed).sort((a, b) => (a.date < b.date ? 1 : -1));
  const selectedEvents = activeEvents.filter((e) => selected && isSameDay(parseDateOnly(e.date), selected));
  const [showDone, setShowDone] = useState(false);

  return (
    <div>
      <PageHeader icon={CalIcon} title="Agenda" subtitle="Seu log futuro, sem pressa."
        action={<Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Adicionar</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Hora</Label><Input value={form.time_str} onChange={(e) => setForm({ ...form, time_str: e.target.value })} placeholder="14:30" /></div>
            </div>
            <div><Label>Tipo</Label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="cozy-card overflow-hidden p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl capitalize">{format(cursor, "MMMM yyyy", { locale: ptBR })}</h3>
          <div className="flex gap-1">
            <button onClick={() => setCursor(subMonths(cursor, 1))} className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setCursor(new Date())} className="rounded-xl border border-border px-3 text-xs hover:bg-accent">Hoje</button>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
          {["dom", "seg", "ter", "qua", "qui", "sex", "sab"].map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((d) => {
            const k = localDateKey(d);
            const dayEvents = activeEvents.filter((e) => e.date === k);
            const isThisMonth = isSameMonth(d, cursor);
            const isToday = isSameDay(d, new Date());
            const isSel = selected && isSameDay(d, selected);
            return (
              <button key={k} onClick={() => setSelected(d)} className={`group min-h-[64px] rounded-xl border p-1.5 text-left text-xs transition ${
                isSel ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
              } ${isThisMonth ? "" : "opacity-40"}`}>
                <div className={`inline-grid h-6 w-6 place-items-center rounded-full font-display text-xs ${isToday ? "bg-primary text-primary-foreground" : ""}`}>
                  {format(d, "d")}
                </div>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((e) => (
                    <div key={e.id} className="truncate rounded bg-blush/40 px-1 py-0.5 text-[10px] text-blush-foreground">
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-6">
        <h3 className="mb-3 font-display text-lg">
          {selected ? format(selected, "EEEE, d 'de' MMMM", { locale: ptBR }) : "Próximos itens"}
        </h3>
        {(selected ? selectedEvents : activeEvents).length === 0 ? (
          <EmptyState title="Nada por aqui ainda" />
        ) : (
          <div className="space-y-2">
            {(selected ? selectedEvents : activeEvents).slice(0, 20).map((e) => (
              <div key={e.id} className="cozy-card flex items-center gap-3 p-3">
                <button onClick={() => toggleDone(e.id, e.completed)} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${e.completed ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {e.completed && <Check className="h-3 w-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${e.completed ? "line-through text-muted-foreground" : ""}`}>{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateBR(e.date).slice(0, 5)} {e.time_str ? `· ${e.time_str}` : ""} · {e.type}
                  </div>
                </div>
                <button onClick={() => { setEditing(e); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setConfirmId(e.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {completedEvents.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowDone(v => !v)} className="mb-3 flex items-center gap-2 font-display text-lg text-muted-foreground hover:text-foreground">
            <Check className="h-4 w-4" /> Eventos concluídos ({completedEvents.length}) {showDone ? "▾" : "▸"}
          </button>
          {showDone && (
            <div className="space-y-2">
              {completedEvents.slice(0, 50).map((e) => (
                <div key={e.id} className="cozy-card flex items-center gap-3 p-3 opacity-75">
                  <button onClick={() => toggleDone(e.id, e.completed)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-primary bg-primary text-primary-foreground" title="Reabrir">
                    <Check className="h-3 w-3" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium line-through text-muted-foreground">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Concluído em {formatDateBR(e.date)} {e.time_str ? `· ${e.time_str}` : ""} · {e.type}
                    </div>
                  </div>
                  <button onClick={() => { setEditing(e); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setConfirmId(e.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove} title="Excluir item?" />
    </div>
  );
}
