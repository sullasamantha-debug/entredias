import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, EmptyState, StatCard } from "@/components/cozy";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Wallet, Plus, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank,
  CreditCard, LineChart, Target, Settings, Sparkles, ArrowRightLeft, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateBR, localDateKey } from "@/lib/dates";
import { fmtBRL, monthKey, addMonth, labelMonth, invoiceMonthFor, dueDateOf, daysUntil } from "@/lib/finance";

export const Route = createFileRoute("/_app/financas")({ component: FinancasPage });

// ---------- types ----------
type Fin = {
  id: string; kind: string; amount: number; category: string | null; description: string | null;
  date: string; payment_method: string | null; installments: number | null; notes: string | null;
  tags: string[] | null; card_id: string | null; paid: boolean; invoice_month: string | null;
};
type Settings = { id: string; initial_balance: number };
type Jar = { id: string; name: string; current_amount: number; goal: number | null; color: string | null; icon: string | null; notes: string | null };
type Inv = { id: string; name: string; category: string | null; invested_amount: number; current_amount: number; notes: string | null };
type Card = { id: string; name: string; card_limit: number; closing_day: number; due_day: number; color: string | null };
type Budget = { id: string; month: string; category: string | null; amount: number };

const PAY = ["pix", "débito", "dinheiro", "crédito"];
const INV_CATS = ["tesouro", "cdb", "poupança", "ações", "fundos", "cripto", "outros"];

// ============================================================
function FinancasPage() {
  const { user } = useAuth();

  const { data: fins } = useQuery({
    enabled: !!user, queryKey: ["finances", user?.id],
    queryFn: async () => ((await supabase.from("finances").select("*").order("date", { ascending: false })).data ?? []) as Fin[],
  });
  const { data: settings } = useQuery({
    enabled: !!user, queryKey: ["finance_settings", user?.id],
    queryFn: async () => ((await supabase.from("finance_settings").select("*").eq("user_id", user!.id).maybeSingle()).data) as Settings | null,
  });
  const { data: jars } = useQuery({
    enabled: !!user, queryKey: ["jars", user?.id],
    queryFn: async () => ((await supabase.from("savings_jars").select("*").order("created_at")).data ?? []) as Jar[],
  });
  const { data: invs } = useQuery({
    enabled: !!user, queryKey: ["investments", user?.id],
    queryFn: async () => ((await supabase.from("investments").select("*").order("created_at")).data ?? []) as Inv[],
  });
  const { data: cards } = useQuery({
    enabled: !!user, queryKey: ["credit_cards", user?.id],
    queryFn: async () => ((await supabase.from("credit_cards").select("*").order("created_at")).data ?? []) as Card[],
  });
  const { data: budgets } = useQuery({
    enabled: !!user, queryKey: ["budgets", user?.id],
    queryFn: async () => ((await supabase.from("budgets").select("*")).data ?? []) as Budget[],
  });

  // -------- derived totals --------
  const today = localDateKey();
  const initial = Number(settings?.initial_balance ?? 0);
  const income = (fins ?? []).filter(f => f.kind === "income" && f.date <= today).reduce((a, f) => a + Number(f.amount), 0);
  const realExpense = (fins ?? []).filter(f => f.kind === "expense" && f.paid && f.date <= today).reduce((a, f) => a + Number(f.amount), 0);
  const futureCardExpense = (fins ?? []).filter(f => f.kind === "expense" && !f.paid && f.card_id).reduce((a, f) => a + Number(f.amount), 0);
  const currentBalance = initial + income - realExpense;
  const totalJars = (jars ?? []).reduce((a, j) => a + Number(j.current_amount), 0);
  const totalInvs = (invs ?? []).reduce((a, i) => a + Number(i.current_amount), 0);
  const patrimony = currentBalance + totalJars + totalInvs;

  return (
    <div>
      <PageHeader icon={Wallet} title="Finanças" subtitle="Sua vida financeira, com calma e clareza." />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Saldo em conta" value={fmtBRL(currentBalance)} icon={Wallet} tint="primary" />
        <StatCard label="Cofrinhos" value={fmtBRL(totalJars)} icon={PiggyBank} tint="mint" />
        <StatCard label="Investimentos" value={fmtBRL(totalInvs)} icon={LineChart} tint="sand" />
        <StatCard label="Patrimônio total" value={fmtBRL(patrimony)} icon={Sparkles} tint="blush"
          hint={futureCardExpense > 0 ? `−${fmtBRL(futureCardExpense)} em faturas` : undefined} />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <div className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="flex w-max gap-1 bg-transparent p-0 md:w-full md:flex-wrap md:justify-start">
            {[
              ["overview", "Visão geral"],
              ["tx", "Transações"],
              ["cards", "Cartões"],
              ["jars", "Cofrinhos"],
              ["invs", "Investimentos"],
              ["budget", "Orçamento"],
              ["config", "Configurações"],
            ].map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="shrink-0 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{l}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview"><Overview fins={fins ?? []} budgets={budgets ?? []} cards={cards ?? []} income={income} realExpense={realExpense} futureCardExpense={futureCardExpense} patrimony={patrimony} /></TabsContent>
        <TabsContent value="tx"><Transactions fins={fins ?? []} cards={cards ?? []} /></TabsContent>
        <TabsContent value="cards"><CardsTab cards={cards ?? []} fins={fins ?? []} /></TabsContent>
        <TabsContent value="jars"><Jars jars={jars ?? []} /></TabsContent>
        <TabsContent value="invs"><Investments invs={invs ?? []} /></TabsContent>
        <TabsContent value="budget"><BudgetTab budgets={budgets ?? []} fins={fins ?? []} /></TabsContent>
        <TabsContent value="config"><Config settings={settings ?? null} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// OVERVIEW
function Overview({ fins, budgets, cards, income, realExpense, futureCardExpense, patrimony }:
  { fins: Fin[]; budgets: Budget[]; cards: Card[]; income: number; realExpense: number; futureCardExpense: number; patrimony: number }) {
  const mk = monthKey();
  const monthStart = `${mk}-01`;
  const next = addMonth(mk, 1);
  const monthEnd = `${next}-01`;

  const monthFins = fins.filter(f => f.date >= monthStart && f.date < monthEnd);
  const monthIn = monthFins.filter(f => f.kind === "income").reduce((a, f) => a + Number(f.amount), 0);
  const monthOut = monthFins.filter(f => f.kind === "expense").reduce((a, f) => a + Number(f.amount), 0);

  // categories
  const byCat = monthFins.filter(f => f.kind === "expense").reduce<Record<string, number>>((acc, f) => {
    const k = f.category || "—"; acc[k] = (acc[k] ?? 0) + Number(f.amount); return acc;
  }, {});
  const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const catMax = Math.max(1, ...catList.map(c => c[1]));

  // insights
  const insights: string[] = [];
  const totalBudget = budgets.find(b => b.month === mk && !b.category);
  if (totalBudget && monthOut > Number(totalBudget.amount)) insights.push(`Você ultrapassou o orçamento do mês em ${fmtBRL(monthOut - Number(totalBudget.amount))}.`);
  for (const b of budgets.filter(b => b.month === mk && b.category)) {
    const spent = byCat[b.category!] ?? 0;
    if (spent >= Number(b.amount)) insights.push(`Você gastou mais do que planejou em ${b.category}.`);
    else if (spent >= Number(b.amount) * 0.8) insights.push(`${b.category} já consumiu ${Math.round((spent / Number(b.amount)) * 100)}% do orçamento.`);
  }
  for (const c of cards) {
    const due = dueDateOf(mk, c.due_day);
    const d = daysUntil(due);
    if (d >= 0 && d <= 7) insights.push(`Fatura de ${c.name} vence em ${d === 0 ? "hoje" : `${d} dia${d > 1 ? "s" : ""}`}.`);
  }
  if (income > 0) insights.push(`Seu patrimônio total está em ${fmtBRL(patrimony)}.`);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Entradas do mês" value={fmtBRL(monthIn)} icon={TrendingUp} tint="mint" />
        <StatCard label="Saídas do mês" value={fmtBRL(monthOut)} icon={TrendingDown} tint="blush" />
        <StatCard label="Saldo do mês" value={fmtBRL(monthIn - monthOut)} tint="primary" />
        <StatCard label="Crédito futuro" value={fmtBRL(futureCardExpense)} icon={CreditCard} tint="sand" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="cozy-card p-5">
          <div className="mb-3 font-display text-lg">Gastos por categoria</div>
          {!catList.length ? <p className="text-sm text-muted-foreground">Sem gastos esse mês ainda.</p> :
            <div className="space-y-3">
              {catList.map(([cat, v]) => (
                <div key={cat}>
                  <div className="mb-1 flex justify-between text-sm"><span>{cat}</span><span className="text-muted-foreground">{fmtBRL(v)}</span></div>
                  <Progress value={(v / catMax) * 100} />
                </div>
              ))}
            </div>}
        </div>

        <div className="cozy-card p-5">
          <div className="mb-3 flex items-center gap-2 font-display text-lg"><Sparkles className="h-4 w-4 text-primary" />Insights</div>
          {!insights.length ? <p className="text-sm text-muted-foreground">Cadastre orçamentos e transações para ver insights aqui.</p> :
            <ul className="space-y-2 text-sm">
              {insights.map((m, i) => <li key={i} className="rounded-xl bg-accent/50 px-3 py-2">{m}</li>)}
            </ul>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TRANSACTIONS
const emptyTx = () => ({
  kind: "expense", amount: 0, category: "", description: "",
  date: localDateKey(), payment_method: "pix", installments: 1, notes: "",
  card_id: "" as string,
});

function Transactions({ fins, cards }: { fins: Fin[]; cards: Card[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Fin | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense" | "credit">("all");
  const [form, setForm] = useState(emptyTx());

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      kind: editing.kind, amount: Number(editing.amount), category: editing.category ?? "",
      description: editing.description ?? "", date: editing.date,
      payment_method: editing.payment_method ?? "pix", installments: editing.installments ?? 1,
      notes: editing.notes ?? "", card_id: editing.card_id ?? "",
    } : emptyTx());
  }, [open, editing]);

  const list = useMemo(() => {
    if (filter === "all") return fins;
    if (filter === "credit") return fins.filter(f => !!f.card_id);
    return fins.filter(f => f.kind === filter);
  }, [fins, filter]);

  const save = async () => {
    if (!user || !form.amount) return;
    const isCredit = form.payment_method === "crédito" && form.card_id;
    const card = isCredit ? cards.find(c => c.id === form.card_id) : null;
    const payload: Partial<Fin> & { user_id?: string } = {
      kind: form.kind, amount: form.amount, category: form.category || null,
      description: form.description || null, date: form.date,
      payment_method: form.payment_method, installments: form.installments,
      notes: form.notes || null,
      card_id: isCredit ? form.card_id : null,
      paid: !isCredit,
      invoice_month: card ? invoiceMonthFor(form.date, card.closing_day) : null,
    };
    const { error } = editing
      ? await supabase.from("finances").update(payload).eq("id", editing.id)
      : await supabase.from("finances").insert({ ...payload, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["finances"] });
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("finances").delete().eq("id", confirmId);
    setConfirmId(null);
    qc.invalidateQueries({ queryKey: ["finances"] });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {([
            ["all", "Todos"], ["income", "Entradas"], ["expense", "Saídas"], ["credit", "Crédito"],
          ] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1.5 text-xs ${filter === k ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"}`}>{l}</button>
          ))}
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Novo registro</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar" : "Novo registro"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              {(["expense", "income"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm capitalize ${form.kind === k ? "border-primary bg-primary/15" : "border-border"}`}>
                  {k === "expense" ? "Saída" : "Entrada"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="alimentação…" /></div>
              <div><Label>Forma</Label>
                <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value, card_id: e.target.value === "crédito" ? form.card_id : "" })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {PAY.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            {form.payment_method === "crédito" && (
              <div>
                <Label>Cartão</Label>
                <select value={form.card_id} onChange={e => setForm({ ...form, card_id: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Selecione…</option>
                  {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!cards.length && <p className="mt-1 text-xs text-muted-foreground">Crie um cartão na aba “Cartões” primeiro.</p>}
              </div>
            )}
            <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!list.length ? <EmptyState title="Sem registros" description="Comece registrando uma entrada ou saída." /> : (
        <div className="space-y-2">
          {list.map((x, i) => {
            const isCredit = !!x.card_id;
            const card = cards.find(c => c.id === x.card_id);
            return (
              <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.015 }} className="cozy-card flex items-center gap-3 p-4">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${x.kind === "income" ? "bg-mint/40" : isCredit ? "bg-accent" : "bg-blush/40"}`}>
                  {x.kind === "income" ? <TrendingUp className="h-4 w-4" /> : isCredit ? <CreditCard className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{x.description || x.category || "Registro"}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDateBR(x.date)}</span>
                    {x.category && <span>· {x.category}</span>}
                    {x.payment_method && <span>· {x.payment_method}</span>}
                    {card && <span>· {card.name}</span>}
                    {isCredit && !x.paid && x.invoice_month && <span className="rounded-full bg-amber-200/60 px-2 text-[10px] text-amber-900">fatura {labelMonth(x.invoice_month)}</span>}
                  </div>
                </div>
                <div className={`font-display text-lg ${x.kind === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                  {x.kind === "income" ? "+" : "−"} {fmtBRL(Number(x.amount))}
                </div>
                <button onClick={() => { setEditing(x); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setConfirmId(x.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </motion.div>
            );
          })}
        </div>
      )}

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove} title="Excluir registro?" />
    </div>
  );
}

// ============================================================
// CARDS
function CardsTab({ cards, fins }: { cards: Card[]; fins: Fin[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", card_limit: 0, closing_day: 1, due_day: 10, color: "#a78bfa" });

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      name: editing.name, card_limit: Number(editing.card_limit), closing_day: editing.closing_day,
      due_day: editing.due_day, color: editing.color ?? "#a78bfa",
    } : { name: "", card_limit: 0, closing_day: 1, due_day: 10, color: "#a78bfa" });
  }, [open, editing]);

  const save = async () => {
    if (!user || !form.name) return;
    const { error } = editing
      ? await supabase.from("credit_cards").update(form).eq("id", editing.id)
      : await supabase.from("credit_cards").insert({ ...form, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["credit_cards"] });
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("credit_cards").delete().eq("id", confirmId);
    setConfirmId(null);
    qc.invalidateQueries({ queryKey: ["credit_cards"] });
  };

  const payInvoice = async (card: Card, invoice: string) => {
    const items = fins.filter(f => f.card_id === card.id && !f.paid && f.invoice_month === invoice);
    if (!items.length) return toast.info("Nada para pagar nessa fatura.");
    const total = items.reduce((a, f) => a + Number(f.amount), 0);
    const due = dueDateOf(invoice, card.due_day);
    const { error: e1 } = await supabase.from("finances").update({ paid: true }).in("id", items.map(i => i.id));
    if (e1) return toast.error(e1.message);
    await supabase.from("finances").insert({
      user_id: user!.id, kind: "expense", amount: total, category: "fatura",
      description: `Fatura ${card.name} (${labelMonth(invoice)})`, date: due,
      payment_method: "débito", installments: 1, paid: true,
    });
    toast.success("Fatura paga.");
    qc.invalidateQueries({ queryKey: ["finances"] });
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Novo cartão</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar cartão" : "Novo cartão"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nubank, Inter…" /></div>
            <div><Label>Limite (R$)</Label><Input type="number" step="0.01" value={form.card_limit} onChange={e => setForm({ ...form, card_limit: +e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dia de fechamento</Label><Input type="number" min={1} max={31} value={form.closing_day} onChange={e => setForm({ ...form, closing_day: +e.target.value })} /></div>
              <div><Label>Dia de vencimento</Label><Input type="number" min={1} max={31} value={form.due_day} onChange={e => setForm({ ...form, due_day: +e.target.value })} /></div>
            </div>
            <div><Label>Cor</Label><Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!cards.length ? <EmptyState title="Sem cartões" description="Cadastre seus cartões para acompanhar faturas." /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => {
            const mk = monthKey();
            const next = addMonth(mk, 1);
            const current = fins.filter(f => f.card_id === c.id && !f.paid && f.invoice_month === mk);
            const upcoming = fins.filter(f => f.card_id === c.id && !f.paid && f.invoice_month === next);
            const used = fins.filter(f => f.card_id === c.id && !f.paid).reduce((a, f) => a + Number(f.amount), 0);
            const curTotal = current.reduce((a, f) => a + Number(f.amount), 0);
            const upTotal = upcoming.reduce((a, f) => a + Number(f.amount), 0);
            const due = dueDateOf(mk, c.due_day);
            const dDays = daysUntil(due);
            const limit = Number(c.card_limit);
            const pct = limit ? (used / limit) * 100 : 0;
            return (
              <div key={c.id} className="cozy-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: c.color ?? "#a78bfa" }}><CreditCard className="h-4 w-4" /></div>
                    <div>
                      <div className="font-display text-lg">{c.name}</div>
                      <div className="text-xs text-muted-foreground">fecha dia {c.closing_day} · vence dia {c.due_day}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(c); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setConfirmId(c.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-sm"><span>Limite usado</span><span className="text-muted-foreground">{fmtBRL(used)} / {fmtBRL(limit)}</span></div>
                    <Progress value={Math.min(100, pct)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-accent/40 p-3">
                      <div className="text-xs text-muted-foreground">Fatura atual</div>
                      <div className="font-display text-lg">{fmtBRL(curTotal)}</div>
                      <div className="text-[11px] text-muted-foreground">vence em {formatDateBR(due)} {dDays >= 0 && `(${dDays}d)`}</div>
                    </div>
                    <div className="rounded-xl bg-accent/40 p-3">
                      <div className="text-xs text-muted-foreground">Próxima fatura</div>
                      <div className="font-display text-lg">{fmtBRL(upTotal)}</div>
                      <div className="text-[11px] text-muted-foreground">{labelMonth(next)}</div>
                    </div>
                  </div>
                  {curTotal > 0 && <Button variant="secondary" onClick={() => payInvoice(c, mk)} className="w-full rounded-full"><CheckCircle2 className="mr-1 h-4 w-4" />Pagar fatura atual</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove} title="Excluir cartão?" description="As transações associadas não serão removidas." />
    </div>
  );
}

// ============================================================
// JARS
function Jars({ jars }: { jars: Jar[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Jar | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [move, setMove] = useState<{ jar: Jar; mode: "deposit" | "withdraw" | "transfer" } | null>(null);
  const [moveAmt, setMoveAmt] = useState(0);
  const [moveTo, setMoveTo] = useState("");
  const [form, setForm] = useState({ name: "", current_amount: 0, goal: 0, color: "#7dd3fc", notes: "" });

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      name: editing.name, current_amount: Number(editing.current_amount), goal: Number(editing.goal ?? 0),
      color: editing.color ?? "#7dd3fc", notes: editing.notes ?? "",
    } : { name: "", current_amount: 0, goal: 0, color: "#7dd3fc", notes: "" });
  }, [open, editing]);

  const save = async () => {
    if (!user || !form.name) return;
    const payload = { name: form.name, current_amount: form.current_amount, goal: form.goal || null, color: form.color, notes: form.notes || null };
    const { error } = editing
      ? await supabase.from("savings_jars").update(payload).eq("id", editing.id)
      : await supabase.from("savings_jars").insert({ ...payload, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["jars"] });
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("savings_jars").delete().eq("id", confirmId);
    setConfirmId(null);
    qc.invalidateQueries({ queryKey: ["jars"] });
  };

  const applyMove = async () => {
    if (!move || !moveAmt) return;
    const jar = move.jar;
    if (move.mode === "deposit") {
      await supabase.from("savings_jars").update({ current_amount: Number(jar.current_amount) + moveAmt }).eq("id", jar.id);
    } else if (move.mode === "withdraw") {
      await supabase.from("savings_jars").update({ current_amount: Math.max(0, Number(jar.current_amount) - moveAmt) }).eq("id", jar.id);
    } else {
      if (!moveTo) return toast.error("Escolha o cofrinho de destino.");
      const target = jars.find(j => j.id === moveTo);
      if (!target) return;
      await supabase.from("savings_jars").update({ current_amount: Math.max(0, Number(jar.current_amount) - moveAmt) }).eq("id", jar.id);
      await supabase.from("savings_jars").update({ current_amount: Number(target.current_amount) + moveAmt }).eq("id", target.id);
    }
    await supabase.from("savings_movements").insert({
      user_id: user!.id, jar_id: jar.id, kind: move.mode === "transfer" ? "transfer_out" : move.mode,
      amount: moveAmt, date: localDateKey(),
    });
    setMove(null); setMoveAmt(0); setMoveTo("");
    qc.invalidateQueries({ queryKey: ["jars"] });
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Novo cofrinho</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar cofrinho" : "Novo cofrinho"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Viagem, Emergência…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor atual</Label><Input type="number" step="0.01" value={form.current_amount} onChange={e => setForm({ ...form, current_amount: +e.target.value })} /></div>
              <div><Label>Meta (opcional)</Label><Input type="number" step="0.01" value={form.goal} onChange={e => setForm({ ...form, goal: +e.target.value })} /></div>
            </div>
            <div><Label>Cor</Label><Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!move} onOpenChange={(o) => !o && setMove(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">
            {move?.mode === "deposit" ? "Depositar" : move?.mode === "withdraw" ? "Retirar" : "Transferir"}
            {" "}— {move?.jar.name}
          </DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Valor</Label><Input type="number" step="0.01" value={moveAmt} onChange={e => setMoveAmt(+e.target.value)} /></div>
            {move?.mode === "transfer" && (
              <div>
                <Label>Para</Label>
                <select value={moveTo} onChange={e => setMoveTo(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Selecione…</option>
                  {jars.filter(j => j.id !== move.jar.id).map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
            )}
            <Button onClick={applyMove} className="w-full rounded-full">Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!jars.length ? <EmptyState title="Sem cofrinhos" description="Crie separações para suas metas: emergência, viagem, casa…" /> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jars.map((j) => {
            const cur = Number(j.current_amount);
            const goal = Number(j.goal ?? 0);
            const pct = goal ? (cur / goal) * 100 : 0;
            return (
              <div key={j.id} className="cozy-card p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: j.color ?? "#7dd3fc" }}><PiggyBank className="h-4 w-4" /></div>
                    <div>
                      <div className="font-display text-lg">{j.name}</div>
                      {goal ? <div className="text-xs text-muted-foreground">Meta: {fmtBRL(goal)}</div> : null}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(j); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setConfirmId(j.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="font-display text-2xl">{fmtBRL(cur)}</div>
                {goal ? <div className="mt-2"><Progress value={Math.min(100, pct)} /><div className="mt-1 text-right text-xs text-muted-foreground">{Math.round(pct)}%</div></div> : null}
                {j.notes && <p className="mt-2 text-sm text-muted-foreground">{j.notes}</p>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" className="flex-1 rounded-full" onClick={() => { setMove({ jar: j, mode: "deposit" }); setMoveAmt(0); }}>Depositar</Button>
                  <Button size="sm" variant="secondary" className="flex-1 rounded-full" onClick={() => { setMove({ jar: j, mode: "withdraw" }); setMoveAmt(0); }}>Retirar</Button>
                  <Button size="sm" variant="ghost" className="rounded-full" onClick={() => { setMove({ jar: j, mode: "transfer" }); setMoveAmt(0); }} title="Transferir"><ArrowRightLeft className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove} title="Excluir cofrinho?" />
    </div>
  );
}

// ============================================================
// INVESTMENTS
function Investments({ invs }: { invs: Inv[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Inv | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", category: "outros", invested_amount: 0, current_amount: 0, notes: "" });

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      name: editing.name, category: editing.category ?? "outros",
      invested_amount: Number(editing.invested_amount), current_amount: Number(editing.current_amount),
      notes: editing.notes ?? "",
    } : { name: "", category: "outros", invested_amount: 0, current_amount: 0, notes: "" });
  }, [open, editing]);

  const save = async () => {
    if (!user || !form.name) return;
    const { error } = editing
      ? await supabase.from("investments").update(form).eq("id", editing.id)
      : await supabase.from("investments").insert({ ...form, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["investments"] });
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("investments").delete().eq("id", confirmId);
    setConfirmId(null);
    qc.invalidateQueries({ queryKey: ["investments"] });
  };

  const totalInv = invs.reduce((a, i) => a + Number(i.invested_amount), 0);
  const totalCur = invs.reduce((a, i) => a + Number(i.current_amount), 0);
  const gain = totalCur - totalInv;
  const gainPct = totalInv ? (gain / totalInv) * 100 : 0;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Investido" value={fmtBRL(totalInv)} tint="sand" />
        <StatCard label="Valor atual" value={fmtBRL(totalCur)} tint="primary" />
        <StatCard label="Rentabilidade" value={`${gain >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`} hint={fmtBRL(gain)} tint={gain >= 0 ? "mint" : "blush"} />
      </div>

      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Novo investimento</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar" : "Novo investimento"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Categoria</Label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {INV_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor investido</Label><Input type="number" step="0.01" value={form.invested_amount} onChange={e => setForm({ ...form, invested_amount: +e.target.value })} /></div>
              <div><Label>Valor atual</Label><Input type="number" step="0.01" value={form.current_amount} onChange={e => setForm({ ...form, current_amount: +e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!invs.length ? <EmptyState title="Sem investimentos" description="Registre seus investimentos para acompanhar o patrimônio." /> : (
        <div className="space-y-2">
          {invs.map(i => {
            const g = Number(i.current_amount) - Number(i.invested_amount);
            const gp = i.invested_amount ? (g / Number(i.invested_amount)) * 100 : 0;
            return (
              <div key={i.id} className="cozy-card flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-sand/60"><LineChart className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-muted-foreground">{i.category} · investido {fmtBRL(Number(i.invested_amount))}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg">{fmtBRL(Number(i.current_amount))}</div>
                  <div className={`text-xs ${g >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{g >= 0 ? "+" : ""}{gp.toFixed(2)}%</div>
                </div>
                <button onClick={() => { setEditing(i); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setConfirmId(i.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove} title="Excluir investimento?" />
    </div>
  );
}

// ============================================================
// BUDGET
function BudgetTab({ budgets, fins }: { budgets: Budget[]; fins: Fin[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthKey());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ category: string; amount: number }>({ category: "", amount: 0 });

  const monthBudgets = budgets.filter(b => b.month === month);
  const total = monthBudgets.find(b => !b.category);
  const cats = monthBudgets.filter(b => b.category);

  const start = `${month}-01`;
  const end = `${addMonth(month, 1)}-01`;
  const monthFins = fins.filter(f => f.kind === "expense" && f.date >= start && f.date < end);
  const spentTotal = monthFins.reduce((a, f) => a + Number(f.amount), 0);
  const spentByCat = monthFins.reduce<Record<string, number>>((acc, f) => {
    const k = f.category || "—"; acc[k] = (acc[k] ?? 0) + Number(f.amount); return acc;
  }, {});

  const upsertBudget = async (category: string | null, amount: number) => {
    if (!user) return;
    const existing = budgets.find(b => b.month === month && (b.category ?? null) === category);
    const payload = { user_id: user.id, month, category, amount };
    const { error } = existing
      ? await supabase.from("budgets").update({ amount }).eq("id", existing.id)
      : await supabase.from("budgets").insert(payload);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const addCat = async () => {
    if (!form.category) return;
    await upsertBudget(form.category, form.amount);
    setOpen(false); setForm({ category: "", amount: 0 });
  };

  const removeBudget = async (id: string) => {
    await supabase.from("budgets").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const colorFor = (pct: number) => pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(addMonth(month, -1))} className="rounded-full bg-accent px-3 py-1 text-sm">←</button>
          <div className="font-display text-lg capitalize">{labelMonth(month)}</div>
          <button onClick={() => setMonth(addMonth(month, 1))} className="rounded-full bg-accent px-3 py-1 text-sm">→</button>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Categoria</Button>
      </div>

      <div className="cozy-card mb-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg"><Target className="h-4 w-4 text-primary" />Orçamento total do mês</div>
          <Input type="number" step="0.01" className="w-40" value={total?.amount ?? 0}
            onChange={(e) => upsertBudget(null, +e.target.value)} />
        </div>
        {total && Number(total.amount) > 0 && (() => {
          const pct = (spentTotal / Number(total.amount)) * 100;
          return (
            <div>
              <div className="mb-1 flex justify-between text-sm"><span>{fmtBRL(spentTotal)} de {fmtBRL(Number(total.amount))}</span><span className={pct >= 100 ? "text-rose-600" : "text-muted-foreground"}>{Math.round(pct)}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-accent"><div className={`h-full ${colorFor(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
            </div>
          );
        })()}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Nova categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Categoria</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="alimentação, lazer…" /></div>
            <div><Label>Limite (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} /></div>
            <Button onClick={addCat} className="w-full rounded-full">Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!cats.length ? <EmptyState title="Sem categorias planejadas" description="Defina limites por categoria para acompanhar o orçamento." /> : (
        <div className="space-y-3">
          {cats.map(b => {
            const spent = spentByCat[b.category!] ?? 0;
            const amt = Number(b.amount);
            const pct = amt ? (spent / amt) * 100 : 0;
            return (
              <div key={b.id} className="cozy-card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-medium capitalize">{b.category}</div>
                  <div className="flex items-center gap-2">
                    <Input type="number" step="0.01" className="w-32" value={b.amount}
                      onChange={(e) => upsertBudget(b.category, +e.target.value)} />
                    <button onClick={() => removeBudget(b.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{fmtBRL(spent)} de {fmtBRL(amt)}</span>
                  <span className={pct >= 100 ? "text-rose-600" : pct >= 80 ? "text-amber-600" : "text-muted-foreground"}>{Math.round(pct)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-accent"><div className={`h-full ${colorFor(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CONFIG
function Config({ settings }: { settings: Settings | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [val, setVal] = useState<number>(Number(settings?.initial_balance ?? 0));

  useEffect(() => { setVal(Number(settings?.initial_balance ?? 0)); }, [settings]);

  const save = async () => {
    if (!user) return;
    const payload = { user_id: user.id, initial_balance: val, updated_at: new Date().toISOString() };
    const { error } = settings
      ? await supabase.from("finance_settings").update(payload).eq("id", settings.id)
      : await supabase.from("finance_settings").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saldo inicial salvo.");
    qc.invalidateQueries({ queryKey: ["finance_settings"] });
  };

  return (
    <div className="max-w-md">
      <div className="cozy-card p-5">
        <div className="mb-3 flex items-center gap-2 font-display text-lg"><Settings className="h-4 w-4 text-primary" />Saldo inicial</div>
        <p className="mb-3 text-sm text-muted-foreground">Quanto você tem hoje em conta. Usado como base para calcular saldo e patrimônio.</p>
        <div className="flex gap-2">
          <Input type="number" step="0.01" value={val} onChange={e => setVal(+e.target.value)} />
          <Button onClick={save} className="rounded-full">Salvar</Button>
        </div>
      </div>
    </div>
  );
}
