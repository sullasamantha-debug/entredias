import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, EmptyState, StatCard } from "@/components/cozy";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TagInput, TagBadges } from "@/components/TagInput";
import { CoverUpload } from "@/components/CoverUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ListChecks, Plus, Trash2, Check, Pencil, Heart, Search, CalendarDays,
  AlertTriangle, Sparkles, Target, ExternalLink, Undo2, Wallet, Tags,
} from "lucide-react";
import { toast } from "sonner";
import { localDateKey, formatDateBR } from "@/lib/dates";
import { fmtBRL } from "@/lib/finance";

export const Route = createFileRoute("/_app/listas")({ component: ListasPage });

/* ---------------- types & constants ---------------- */

type Task = {
  id: string; title: string; description: string | null; date: string; due_date: string | null;
  priority: string; category: string | null; tags: string[] | null; status: string;
  completed_at: string | null; goal_id: string | null; created_at: string;
};
type Wish = {
  id: string; name: string; description: string | null; category: string | null; wish_type: string;
  image_url: string | null; link: string | null; estimated_value: number | null; paid_value: number | null;
  priority: string; tags: string[] | null; notes: string | null; status: string;
  added_date: string; realized_date: string | null; goal_id: string | null; created_at: string;
};
type Goal = { id: string; title: string };
type Cat = { id: string; name: string; scope: string };

const PRIORITIES = [
  { v: "alta", label: "Alta", cls: "bg-destructive/15 text-destructive" },
  { v: "media", label: "Média", cls: "bg-sand/70 text-foreground" },
  { v: "baixa", label: "Baixa", cls: "bg-mint/50 text-foreground" },
] as const;
const prioMeta = (v: string) => PRIORITIES.find((p) => p.v === v) ?? PRIORITIES[1];
const prioRank = (v: string) => ({ alta: 0, media: 1, baixa: 2 }[v] ?? 1);

const TASK_STATUS = [
  { v: "pendente", label: "Pendente" },
  { v: "andamento", label: "Em andamento" },
  { v: "concluida", label: "Concluída" },
] as const;

const WISH_TYPES = ["comprar", "fazer", "conhecer", "viajar", "ler", "assistir", "outros"] as const;
const WISH_STATUS = [
  { v: "quero", label: "Quero" },
  { v: "planejado", label: "Planejado" },
  { v: "realizado", label: "Realizado" },
] as const;

const emptyTask = () => ({
  title: "", description: "", date: localDateKey(), due_date: "", priority: "media",
  category: "", tags: [] as string[], status: "pendente", goal_id: "",
});
const emptyWish = () => ({
  name: "", description: "", category: "", wish_type: "comprar", image_url: null as string | null,
  link: "", estimated_value: "", paid_value: "", priority: "media", tags: [] as string[],
  notes: "", status: "quero", added_date: localDateKey(), goal_id: "",
});

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/* ---------------- page ---------------- */

function ListasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"tarefas" | "desejos">("tarefas");

  const { data: tasks } = useQuery({
    enabled: !!user, queryKey: ["tasks", user?.id],
    queryFn: async () => ((await supabase.from("tasks").select("*").order("date")).data ?? []) as Task[],
  });
  const { data: wishes } = useQuery({
    enabled: !!user, queryKey: ["wishes", user?.id],
    queryFn: async () => ((await supabase.from("wishes").select("*").order("created_at", { ascending: false })).data ?? []) as Wish[],
  });
  const { data: goals } = useQuery({
    enabled: !!user, queryKey: ["goals", user?.id],
    queryFn: async () => ((await supabase.from("goals").select("id,title").order("title")).data ?? []) as Goal[],
  });
  const { data: cats } = useQuery({
    enabled: !!user, queryKey: ["list_categories", user?.id],
    queryFn: async () => ((await supabase.from("list_categories").select("*").order("name")).data ?? []) as Cat[],
  });

  const today = localDateKey();
  const tList = tasks ?? [];
  const wList = wishes ?? [];
  const pending = tList.filter((t) => t.status !== "concluida");
  const forToday = pending.filter((t) => (t.due_date ?? t.date) === today);
  const late = pending.filter((t) => (t.due_date ?? t.date) < today);
  const doneTasks = tList.filter((t) => t.status === "concluida");
  const estimated = wList.filter((w) => w.status !== "realizado").reduce((a, w) => a + Number(w.estimated_value ?? 0), 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["wishes"] });
    qc.invalidateQueries({ queryKey: ["list_categories"] });
  };

  return (
    <div className="pb-6">
      <PageHeader
        icon={ListChecks}
        title="Listas"
        subtitle="O que você precisa fazer e o que você deseja viver."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tab === "tarefas" ? (
          <>
            <StatCard label="Pendentes" value={pending.length} icon={ListChecks} />
            <StatCard label="Para hoje" value={forToday.length} icon={CalendarDays} tint="mint" />
            <StatCard label="Atrasadas" value={late.length} icon={AlertTriangle} tint="blush" />
            <StatCard label="Concluídas" value={doneTasks.length} icon={Check} tint="sand" />
          </>
        ) : (
          <>
            <StatCard label="Desejos" value={wList.length} icon={Heart} />
            <StatCard label="Planejados" value={wList.filter((w) => w.status === "planejado").length} icon={Sparkles} tint="mint" />
            <StatCard label="Realizados" value={wList.filter((w) => w.status === "realizado").length} icon={Check} tint="blush" />
            <StatCard label="Valor estimado" value={fmtBRL(estimated)} icon={Wallet} tint="sand" />
          </>
        )}
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {([["tarefas", "✓ Tarefas"], ["desejos", "♡ Desejos"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
              tab === v ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:bg-accent"
            }`}>{l}</button>
        ))}
      </div>

      {tab === "tarefas"
        ? <TasksTab tasks={tList} goals={goals ?? []} cats={cats ?? []} onChange={invalidate} />
        : <WishesTab wishes={wList} goals={goals ?? []} cats={cats ?? []} onChange={invalidate} />}

      <CategoriesManager cats={cats ?? []} onChange={invalidate} />
    </div>
  );
}

/* ---------------- tarefas ---------------- */

const VIEWS = [
  { v: "hoje", label: "Hoje" },
  { v: "proximas", label: "Próximas" },
  { v: "atrasadas", label: "Atrasadas" },
  { v: "todas", label: "Todas" },
  { v: "concluidas", label: "Concluídas" },
] as const;

function TasksTab({ tasks, goals, cats, onChange }: { tasks: Task[]; goals: Goal[]; cats: Cat[]; onChange: () => void }) {
  const { user } = useAuth();
  const [view, setView] = useState<(typeof VIEWS)[number]["v"]>("hoje");
  const [q, setQ] = useState("");
  const [prio, setPrio] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTask());
  const [agendaAsk, setAgendaAsk] = useState<{ title: string; date: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      title: editing.title, description: editing.description ?? "", date: editing.date,
      due_date: editing.due_date ?? "", priority: editing.priority, category: editing.category ?? "",
      tags: editing.tags ?? [], status: editing.status, goal_id: editing.goal_id ?? "",
    } : emptyTask());
  }, [open, editing]);

  const today = localDateKey();

  const save = async () => {
    if (!user || !form.title.trim()) return toast.error("Informe o título.");
    const payload = {
      title: form.title.trim(), description: form.description || null, date: form.date,
      due_date: form.due_date || null, priority: form.priority, category: form.category || null,
      tags: form.tags.length ? form.tags : null, status: form.status,
      completed_at: form.status === "concluida" ? new Date().toISOString() : null,
      goal_id: form.goal_id || null,
    };
    const { error } = editing
      ? await supabase.from("tasks").update(payload).eq("id", editing.id)
      : await supabase.from("tasks").insert({ ...payload, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null); onChange();
    if (!editing) setAgendaAsk({ title: payload.title, date: payload.due_date ?? payload.date });
  };

  const toggle = async (t: Task) => {
    const done = t.status === "concluida";
    await supabase.from("tasks").update({
      status: done ? "pendente" : "concluida",
      completed_at: done ? null : new Date().toISOString(),
    }).eq("id", t.id);
    onChange();
    toast.success(done ? "Tarefa reaberta." : "Tarefa concluída ✨");
  };
  const setPriority = async (t: Task, p: string) => { await supabase.from("tasks").update({ priority: p }).eq("id", t.id); onChange(); };
  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("tasks").delete().eq("id", confirmId);
    setConfirmId(null); onChange();
  };
  const addToAgenda = async () => {
    if (!user || !agendaAsk) return;
    const { error } = await supabase.from("events").insert({
      user_id: user.id, title: agendaAsk.title, date: agendaAsk.date, type: "compromisso", completed: false,
    });
    setAgendaAsk(null);
    if (error) return toast.error(error.message);
    toast.success("Adicionado à Agenda.");
  };

  const list = useMemo(() => {
    let l = tasks;
    if (view === "concluidas") l = l.filter((t) => t.status === "concluida");
    else {
      l = l.filter((t) => t.status !== "concluida");
      const d = (t: Task) => t.due_date ?? t.date;
      if (view === "hoje") l = l.filter((t) => d(t) === today);
      if (view === "proximas") l = l.filter((t) => d(t) > today);
      if (view === "atrasadas") l = l.filter((t) => d(t) < today);
    }
    if (prio !== "all") l = l.filter((t) => t.priority === prio);
    const s = q.trim().toLowerCase();
    if (s) l = l.filter((t) =>
      t.title.toLowerCase().includes(s) || (t.description ?? "").toLowerCase().includes(s) ||
      (t.category ?? "").toLowerCase().includes(s) || (t.tags ?? []).some((x) => x.toLowerCase().includes(s)));
    return [...l].sort((a, b) => prioRank(a.priority) - prioRank(b.priority) || (a.due_date ?? a.date).localeCompare(b.due_date ?? b.date));
  }, [tasks, view, prio, q, today]);

  const goalTitle = (id: string | null) => goals.find((g) => g.id === id)?.title;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar tarefas" className="pl-9" />
        </div>
        <select value={prio} onChange={(e) => setPrio(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="all">Todas prioridades</option>
          {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
        </select>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Nova tarefa</Button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {VIEWS.map((v) => (
          <button key={v.v} onClick={() => setView(v.v)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
              view === v.v ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:bg-accent"
            }`}>{v.label}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title="Nada por aqui" description="Crie uma tarefa para começar a organizar seus dias." />
      ) : (
        <div className="space-y-2">
          {list.map((t, i) => {
            const done = t.status === "concluida";
            const d = t.due_date ?? t.date;
            const overdue = !done && d < today;
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className={`cozy-card flex items-start gap-3 p-3 ${done ? "opacity-70" : ""}`}>
                <button onClick={() => toggle(t)} title={done ? "Desfazer conclusão" : "Concluir"}
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {done ? <Check className="h-3 w-3" /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                  {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={`rounded-full px-2 py-0.5 ${prioMeta(t.priority).cls}`}>{prioMeta(t.priority).label}</span>
                    <span className={overdue ? "text-destructive" : ""}>{formatDateBR(d)}</span>
                    {t.status === "andamento" && <span className="rounded-full bg-accent px-2 py-0.5">Em andamento</span>}
                    {t.category && <span className="rounded-full bg-accent px-2 py-0.5">{t.category}</span>}
                    {t.goal_id && goalTitle(t.goal_id) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-foreground/80">
                        <Target className="h-3 w-3" />{goalTitle(t.goal_id)}
                      </span>
                    )}
                    {done && t.completed_at && <span>Concluída em {formatDateBR(t.completed_at.slice(0, 10))}</span>}
                  </div>
                  <div className="mt-1.5"><TagBadges tags={t.tags} /></div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <select value={t.priority} onChange={(e) => setPriority(t, e.target.value)}
                    className="hidden rounded-lg border border-border bg-background px-2 py-1 text-[11px] sm:block" aria-label="Prioridade">
                    {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                  </select>
                  <button onClick={() => { setEditing(t); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setConfirmId(t.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar tarefa" : "Nova tarefa"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Organizar documentos" /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prioridade</Label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </div>
              <div><Label>Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {TASK_STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div><Label>Categoria</Label>
              <Input list="list-cats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Casa, Trabalho..." />
              <datalist id="list-cats">{cats.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </div>
            <div><Label>Tags</Label><TagInput value={form.tags} onChange={(tags) => setForm({ ...form, tags })} /></div>
            <div><Label>Vincular a uma meta</Label>
              <select value={form.goal_id} onChange={(e) => setForm({ ...form, goal_id: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Nenhuma</option>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Criar tarefa"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!agendaAsk} onOpenChange={(o) => !o && setAgendaAsk(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Adicionar à Agenda?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja criar um compromisso na Agenda para “{agendaAsk?.title}” em {formatDateBR(agendaAsk?.date)}?
          </p>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setAgendaAsk(null)}>Agora não</Button>
            <Button className="rounded-full" onClick={addToAgenda}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove} title="Excluir tarefa?" />
    </div>
  );
}

/* ---------------- desejos ---------------- */

const WISH_SORTS = [
  { v: "recentes", label: "Mais recentes" },
  { v: "antigos", label: "Mais antigos" },
  { v: "prioridade", label: "Prioridade" },
  { v: "menor", label: "Menor valor" },
  { v: "maior", label: "Maior valor" },
  { v: "az", label: "Ordem alfabética" },
] as const;

function WishesTab({ wishes, goals, cats, onChange }: { wishes: Wish[]; goals: Goal[]; cats: Cat[]; onChange: () => void }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [cat, setCat] = useState("all");
  const [prio, setPrio] = useState("all");
  const [tag, setTag] = useState("all");
  const [minV, setMinV] = useState("");
  const [maxV, setMaxV] = useState("");
  const [sort, setSort] = useState<(typeof WISH_SORTS)[number]["v"]>("recentes");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Wish | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyWish());
  const [financeAsk, setFinanceAsk] = useState<Wish | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      name: editing.name, description: editing.description ?? "", category: editing.category ?? "",
      wish_type: editing.wish_type, image_url: editing.image_url, link: editing.link ?? "",
      estimated_value: editing.estimated_value != null ? String(editing.estimated_value) : "",
      paid_value: editing.paid_value != null ? String(editing.paid_value) : "",
      priority: editing.priority, tags: editing.tags ?? [], notes: editing.notes ?? "",
      status: editing.status, added_date: editing.added_date, goal_id: editing.goal_id ?? "",
    } : emptyWish());
  }, [open, editing]);

  const allTags = useMemo(() => Array.from(new Set(wishes.flatMap((w) => w.tags ?? []))).sort(collator.compare), [wishes]);

  const save = async () => {
    if (!user || !form.name.trim()) return toast.error("Informe o nome do desejo.");
    const payload = {
      name: form.name.trim(), description: form.description || null, category: form.category || null,
      wish_type: form.wish_type, image_url: form.image_url, link: form.link || null,
      estimated_value: form.estimated_value === "" ? null : Number(form.estimated_value),
      paid_value: form.paid_value === "" ? null : Number(form.paid_value),
      priority: form.priority, tags: form.tags.length ? form.tags : null, notes: form.notes || null,
      status: form.status, added_date: form.added_date,
      realized_date: form.status === "realizado" ? (editing?.realized_date ?? localDateKey()) : null,
      goal_id: form.goal_id || null,
    };
    const { error } = editing
      ? await supabase.from("wishes").update(payload).eq("id", editing.id)
      : await supabase.from("wishes").insert({ ...payload, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null); onChange();
  };

  const setStatusOf = async (w: Wish, s: string) => {
    const realized = s === "realizado";
    await supabase.from("wishes").update({
      status: s, realized_date: realized ? (w.realized_date ?? localDateKey()) : null,
    }).eq("id", w.id);
    onChange();
    if (realized) setFinanceAsk({ ...w, status: s, realized_date: w.realized_date ?? localDateKey() });
  };

  const registerExpense = async () => {
    if (!user || !financeAsk) return;
    const amount = Number(financeAsk.paid_value ?? financeAsk.estimated_value ?? 0);
    if (!amount) { setFinanceAsk(null); return toast.error("Informe o valor pago no desejo."); }
    const { error } = await supabase.from("finances").insert({
      user_id: user.id, kind: "expense", amount,
      category: financeAsk.category || "desejos",
      description: `Desejo realizado: ${financeAsk.name}`,
      date: financeAsk.realized_date ?? localDateKey(),
      payment_method: "débito", installments: 1, paid: true,
    });
    setFinanceAsk(null);
    if (error) return toast.error(error.message);
    toast.success("Despesa registrada nas finanças.");
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("wishes").delete().eq("id", confirmId);
    setConfirmId(null); onChange();
  };

  const list = useMemo(() => {
    let l = wishes;
    if (status !== "all") l = l.filter((w) => w.status === status);
    if (type !== "all") l = l.filter((w) => w.wish_type === type);
    if (cat !== "all") l = l.filter((w) => (w.category ?? "") === cat);
    if (prio !== "all") l = l.filter((w) => w.priority === prio);
    if (tag !== "all") l = l.filter((w) => (w.tags ?? []).includes(tag));
    if (minV !== "") l = l.filter((w) => Number(w.estimated_value ?? 0) >= Number(minV));
    if (maxV !== "") l = l.filter((w) => Number(w.estimated_value ?? 0) <= Number(maxV));
    const s = q.trim().toLowerCase();
    if (s) l = l.filter((w) =>
      w.name.toLowerCase().includes(s) || (w.description ?? "").toLowerCase().includes(s) ||
      (w.tags ?? []).some((x) => x.toLowerCase().includes(s)));
    const val = (w: Wish) => Number(w.estimated_value ?? 0);
    return [...l].sort((a, b) => {
      switch (sort) {
        case "antigos": return a.created_at.localeCompare(b.created_at);
        case "prioridade": return prioRank(a.priority) - prioRank(b.priority);
        case "menor": return val(a) - val(b);
        case "maior": return val(b) - val(a);
        case "az": return collator.compare(a.name, b.name);
        default: return b.created_at.localeCompare(a.created_at);
      }
    });
  }, [wishes, status, type, cat, prio, tag, minV, maxV, q, sort]);

  const catOptions = useMemo(
    () => Array.from(new Set([...cats.map((c) => c.name), ...wishes.map((w) => w.category ?? "")].filter(Boolean))).sort(collator.compare),
    [cats, wishes],
  );
  const goalTitle = (id: string | null) => goals.find((g) => g.id === id)?.title;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar desejos" className="pl-9" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          {WISH_SORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Novo desejo</Button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs">
          <option value="all">Todos status</option>
          {WISH_STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs">
          <option value="all">Todos tipos</option>
          {WISH_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs">
          <option value="all">Todas categorias</option>
          {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={prio} onChange={(e) => setPrio(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs">
          <option value="all">Todas prioridades</option>
          {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs">
          <option value="all">Todas tags</option>
          {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
        </select>
        <Input value={minV} onChange={(e) => setMinV(e.target.value)} type="number" placeholder="Valor mín." className="h-8 w-28 text-xs" />
        <Input value={maxV} onChange={(e) => setMaxV(e.target.value)} type="number" placeholder="Valor máx." className="h-8 w-28 text-xs" />
      </div>

      {list.length === 0 ? (
        <EmptyState title="Sua lista de desejos está vazia" description="Anote o que você quer comprar, fazer, conhecer ou viver." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((w, i) => (
            <motion.div key={w.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className={`cozy-card overflow-hidden p-4 ${w.status === "realizado" ? "bg-mint/15" : ""}`}>
              <div className="flex gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 to-blush/25">
                  {w.image_url
                    ? <img src={w.image_url} alt={w.name} loading="lazy" className="h-full w-full object-cover" />
                    : <div className="grid h-full place-items-center text-primary"><Heart className="h-5 w-5" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base leading-tight">{w.name}</h3>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => { setEditing(w); setOpen(true); }} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setConfirmId(w.id)} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-accent px-2 py-0.5 capitalize">{w.wish_type}</span>
                    <span className={`rounded-full px-2 py-0.5 ${prioMeta(w.priority).cls}`}>{prioMeta(w.priority).label}</span>
                    {w.category && <span className="rounded-full bg-accent px-2 py-0.5">{w.category}</span>}
                  </div>
                  {w.description && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{w.description}</p>}
                </div>
              </div>

              {(w.estimated_value != null || w.paid_value != null) && (
                <div className="mt-3 flex flex-wrap gap-4 text-xs">
                  {w.estimated_value != null && <div><span className="text-muted-foreground">Estimado</span><div className="font-display text-base">{fmtBRL(Number(w.estimated_value))}</div></div>}
                  {w.paid_value != null && <div><span className="text-muted-foreground">Pago</span><div className="font-display text-base">{fmtBRL(Number(w.paid_value))}</div></div>}
                </div>
              )}

              <div className="mt-3"><TagBadges tags={w.tags} /></div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>Adicionado em {formatDateBR(w.added_date)}</span>
                {w.realized_date && <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" />Realizado em {formatDateBR(w.realized_date)}</span>}
                {w.goal_id && goalTitle(w.goal_id) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-foreground/80"><Target className="h-3 w-3" />{goalTitle(w.goal_id)}</span>
                )}
                {w.link && (
                  <a href={w.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" />Link
                  </a>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {WISH_STATUS.map((s) => (
                  <button key={s.v} onClick={() => setStatusOf(w, s.v)}
                    className={`rounded-full border px-3 py-1 text-[11px] transition ${
                      w.status === s.v ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:bg-accent"
                    }`}>{s.label}</button>
                ))}
                {w.status === "realizado" && (
                  <button onClick={() => setStatusOf(w, "quero")} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground hover:bg-accent">
                    <Undo2 className="h-3 w-3" />Desfazer
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar desejo" : "Novo desejo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Air Fryer, Japão, Curso de cerâmica..." /></div>
            <div><Label>Imagem</Label><CoverUpload value={form.image_url} onChange={(image_url) => setForm({ ...form, image_url })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <select value={form.wish_type} onChange={(e) => setForm({ ...form, wish_type: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize">
                  {WISH_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><Label>Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {WISH_STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label>
                <Input list="list-cats-w" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Casa, Viagem..." />
                <datalist id="list-cats-w">{cats.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              </div>
              <div><Label>Prioridade</Label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor estimado</Label><Input type="number" step="0.01" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} /></div>
              <div><Label>Valor pago</Label><Input type="number" step="0.01" value={form.paid_value} onChange={(e) => setForm({ ...form, paid_value: e.target.value })} /></div>
            </div>
            <div><Label>Link</Label><Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" /></div>
            <div><Label>Tags</Label><TagInput value={form.tags} onChange={(tags) => setForm({ ...form, tags })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Adicionado em</Label><Input type="date" value={form.added_date} onChange={(e) => setForm({ ...form, added_date: e.target.value })} /></div>
              <div><Label>Meta</Label>
                <select value={form.goal_id} onChange={(e) => setForm({ ...form, goal_id: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Nenhuma</option>
                  {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>
            </div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Criar desejo"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!financeAsk} onOpenChange={(o) => !o && setFinanceAsk(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Registrar nas finanças?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja registrar essa compra nas suas finanças? Valor: {fmtBRL(Number(financeAsk?.paid_value ?? financeAsk?.estimated_value ?? 0))}
          </p>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setFinanceAsk(null)}>Agora não</Button>
            <Button className="rounded-full" onClick={registerExpense}>Registrar despesa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove} title="Excluir desejo?" />
    </div>
  );
}

/* ---------------- categorias ---------------- */

function CategoriesManager({ cats, onChange }: { cats: Cat[]; onChange: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const add = async () => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("list_categories").insert({ user_id: user.id, name: name.trim(), scope: "both" });
    if (error) return toast.error(error.message);
    setName(""); onChange();
  };
  const remove = async (id: string) => { await supabase.from("list_categories").delete().eq("id", id); onChange(); };

  return (
    <div className="mt-8">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <Tags className="h-4 w-4" /> Categorias personalizadas ({cats.length}) {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="cozy-card mt-3 p-4">
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs">
                {c.name}
                <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive">×</button>
              </span>
            ))}
            {cats.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma categoria criada ainda.</span>}
          </div>
          <div className="mt-3 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria (Casa, Viagem...)"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
            <Button onClick={add} className="rounded-full"><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
