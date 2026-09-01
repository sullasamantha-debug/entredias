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
  Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateBR, localDateKey } from "@/lib/dates";
import { fmtBRL, monthKey, addMonth, labelMonth, invoiceMonthFor, dueDateOf, daysUntil, dailyBalances } from "@/lib/finance";
import { OFXImportsHistory, OFXCardImportButton } from "@/components/OFXImport";
import { ImportStatementMenu } from "@/components/PDFImport";
import { patFinanceRow } from "@/lib/patrimony";

export const Route = createFileRoute("/_app/financas")({ component: FinancasPage });

// ---------- types ----------
type Fin = {
  id: string; kind: string; amount: number; category: string | null; description: string | null;
  date: string; payment_method: string | null; installments: number | null; notes: string | null;
  tags: string[] | null; card_id: string | null; paid: boolean; invoice_month: string | null;
  account_id: string | null; to_account_id: string | null;
};
type Settings = { id: string; initial_balance: number };
type Account = {
  id: string; name: string; type: string; initial_balance: number;
  initial_balance_date: string;
  color: string | null; icon: string | null; notes: string | null; archived: boolean;
};
type Jar = { id: string; name: string; current_amount: number; goal: number | null; color: string | null; icon: string | null; notes: string | null; account_id: string | null };
type Inv = { id: string; name: string; category: string | null; invested_amount: number; current_amount: number; notes: string | null; institution: string | null; invested_date: string | null };
type Card = { id: string; name: string; card_limit: number; closing_day: number; due_day: number; color: string | null };
type Budget = {
  id: string; month: string; category: string | null; amount: number;
  kind: string; ref_id: string | null; realized_amount: number | null; label: string | null;
};
type PlannedIncome = {
  id: string; month: string; description: string; category: string | null; amount: number;
  expected_date: string | null; account_id: string | null; received: boolean; notes: string | null;
};
type Movement = { id: string; jar_id: string; kind: string; amount: number; date: string };
export type CatType = "receita" | "despesa" | "reserva" | "investimento";
type Cat = { id: string; name: string; type: CatType; color: string | null; icon: string | null; archived: boolean };


const PAY = ["pix", "débito", "dinheiro", "crédito"];
const INV_CATS = ["tesouro", "cdb", "poupança", "ações", "fundos", "cripto", "outros"];
const ACCOUNT_TYPES: { value: string; label: string }[] = [
  { value: "corrente", label: "Conta corrente" },
  { value: "digital", label: "Conta digital" },
  { value: "carteira", label: "Carteira" },
  { value: "poupanca", label: "Poupança" },
  { value: "investimento", label: "Investimento" },
  { value: "outro", label: "Outro" },
];
const ACCOUNT_TYPE_LABEL = Object.fromEntries(ACCOUNT_TYPES.map(t => [t.value, t.label]));

// Category suggestions per type — used as datalist hints in budget / income forms
const INCOME_CAT_SUGGESTIONS = ["Salário", "Freelance", "Rendimentos", "Reembolso", "Vale Alimentação", "13º", "Bônus"];
const EXPENSE_CAT_SUGGESTIONS = ["Mercado", "Restaurante", "Transporte", "Saúde", "Pets", "Educação", "Lazer", "Assinaturas", "Viagem", "Casa", "Contas"];
const RESERVE_CAT_SUGGESTIONS = ["Emergência", "Viagem", "Casa", "Carro", "Estudos", "Presente"];
const INVEST_CAT_SUGGESTIONS = ["Tesouro Selic", "Tesouro IPCA", "CDB", "LCI", "LCA", "Fundos", "Ações", "Cripto"];

const DEFAULT_CATEGORIES: { type: CatType; names: string[] }[] = [
  { type: "receita", names: INCOME_CAT_SUGGESTIONS },
  { type: "despesa", names: EXPENSE_CAT_SUGGESTIONS },
  { type: "reserva", names: RESERVE_CAT_SUGGESTIONS },
  { type: "investimento", names: INVEST_CAT_SUGGESTIONS },
];

const CAT_TYPE_LABEL: Record<CatType, string> = {
  receita: "Receita", despesa: "Despesa", reserva: "Reserva", investimento: "Investimento",
};
const CAT_TYPE_TINT: Record<CatType, string> = {
  receita: "bg-emerald-500/15 text-emerald-700",
  despesa: "bg-rose-500/15 text-rose-700",
  reserva: "bg-sky-500/15 text-sky-700",
  investimento: "bg-amber-500/15 text-amber-800",
};

// Compute per-account balance considering income, expenses (paid only), and transfers
function balanceFor(account: Account, fins: Fin[], today: string) {
  let bal = Number(account.initial_balance) || 0;
  const since = account.initial_balance_date || "0000-01-01";
  for (const f of fins) {
    if (f.date > today) continue;
    if (f.date < since) continue;
    const amt = Number(f.amount) || 0;
    if (f.kind === "income" && f.account_id === account.id) bal += amt;
    else if (f.kind === "expense" && f.paid && f.account_id === account.id) bal -= amt;
    else if (f.kind === "transfer") {
      if (f.account_id === account.id) bal -= amt;
      if (f.to_account_id === account.id) bal += amt;
    }
  }
  return bal;
}

// ============================================================
function FinancasPage() {
  const { user } = useAuth();

  const { data: fins } = useQuery({
    enabled: !!user, queryKey: ["finances", user?.id],
    queryFn: async () => ((await supabase.from("finances").select("*").order("date", { ascending: false })).data ?? []) as Fin[],
  });
  const { data: accounts } = useQuery({
    enabled: !!user, queryKey: ["accounts", user?.id],
    queryFn: async () => ((await supabase.from("accounts").select("*").order("created_at")).data ?? []) as Account[],
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
  const { data: plannedIncomes } = useQuery({
    enabled: !!user, queryKey: ["planned_incomes", user?.id],
    queryFn: async () => ((await supabase.from("planned_incomes").select("*").order("expected_date", { nullsFirst: false })).data ?? []) as PlannedIncome[],
  });
  const { data: movements } = useQuery({
    enabled: !!user, queryKey: ["savings_movements", user?.id],
    queryFn: async () => ((await supabase.from("savings_movements").select("*")).data ?? []) as Movement[],
  });
  const { data: cats } = useQuery({
    enabled: !!user, queryKey: ["finance_categories", user?.id],
    queryFn: async () => (((await (supabase as any).from("finance_categories").select("*").order("name")).data) ?? []) as Cat[],
  });
  const qcSeed = useQueryClient();
  useEffect(() => {
    if (!user || !cats) return;
    if (cats.length > 0) return;
    (async () => {
      const rows = DEFAULT_CATEGORIES.flatMap(g => g.names.map(n => ({ user_id: user.id, name: n, type: g.type })));
      await (supabase as any).from("finance_categories").insert(rows);
      qcSeed.invalidateQueries({ queryKey: ["finance_categories"] });
    })();
  }, [user, cats, qcSeed]);


  // -------- derived totals --------
  const today = localDateKey();
  const accountList = accounts ?? [];
  const finList = fins ?? [];

  const accountsTotal = accountList.length
    ? accountList.reduce((a, ac) => a + balanceFor(ac, finList, today), 0)
    : (() => {
        const income = finList.filter(f => f.kind === "income" && f.date <= today).reduce((a, f) => a + Number(f.amount), 0);
        const realExpense = finList.filter(f => f.kind === "expense" && f.paid && f.date <= today).reduce((a, f) => a + Number(f.amount), 0);
        return income - realExpense;
      })();

  const futureCardExpense = finList.filter(f => f.kind === "expense" && !f.paid && f.card_id).reduce((a, f) => a + Number(f.amount), 0);
  const totalJars = (jars ?? []).reduce((a, j) => a + Number(j.current_amount), 0);
  const totalInvs = (invs ?? []).reduce((a, i) => a + Number(i.current_amount), 0);
  // Patrimônio total = contas + reservas + investimentos.
  const patrimony = accountsTotal + totalJars + totalInvs;

  return (
    <div>
      <PageHeader icon={Wallet} title="Finanças" subtitle="Sua vida financeira, com calma e clareza." />

      <div className="mb-3 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Saldo em contas" value={fmtBRL(accountsTotal)} icon={Wallet} tint="primary"
          hint={accountList.length ? `${accountList.length} conta${accountList.length > 1 ? "s" : ""}` : undefined} />
        <StatCard label="Reservado" value={fmtBRL(totalJars)} icon={PiggyBank} tint="mint"
          hint="guardado em reservas" />
        <StatCard label="Investido" value={fmtBRL(totalInvs)} icon={LineChart} tint="sand" />
        <StatCard label="Patrimônio total" value={fmtBRL(patrimony)} icon={Sparkles} tint="blush"
          hint={futureCardExpense > 0 ? `−${fmtBRL(futureCardExpense)} em faturas` : "contas + reservas + investimentos"} />
      </div>
      <div className="mb-8 flex justify-end">
        <PatrimonyAudit accounts={accountList} fins={finList} invs={invs ?? []} jars={jars ?? []} accountsTotal={accountsTotal} totalInvs={totalInvs} totalJars={totalJars} futureCardExpense={futureCardExpense} patrimony={patrimony} today={today} />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <div className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="flex w-max gap-1 bg-transparent p-0 md:w-full md:flex-wrap md:justify-start">
            {[
              ["overview", "Visão geral"],
              ["accounts", "Contas"],
              ["tx", "Transações"],
              ["cards", "Cartões"],
              ["jars", "Reservas"],
              ["invs", "Investimentos"],
              ["budget", "Planejamento"],
            ].map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="shrink-0 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{l}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview"><Overview fins={finList} budgets={budgets ?? []} cards={cards ?? []} accounts={accountList} jars={jars ?? []} invs={invs ?? []} accountsTotal={accountsTotal} totalJars={totalJars} totalInvs={totalInvs} futureCardExpense={futureCardExpense} patrimony={patrimony} today={today} /></TabsContent>
        <TabsContent value="accounts"><AccountsTab accounts={accountList} fins={finList} jars={jars ?? []} today={today} cats={cats ?? []} cards={cards ?? []} /></TabsContent>
        <TabsContent value="tx"><Transactions fins={finList} cards={cards ?? []} accounts={accountList} cats={cats ?? []} budgets={budgets ?? []} /></TabsContent>
        <TabsContent value="cards"><CardsTab cards={cards ?? []} fins={finList} accounts={accountList} cats={cats ?? []} /></TabsContent>
        <TabsContent value="jars"><Jars jars={jars ?? []} accounts={accountList} /></TabsContent>
        <TabsContent value="invs"><Investments invs={invs ?? []} accounts={accountList} /></TabsContent>
        <TabsContent value="budget"><PlanningTab budgets={budgets ?? []} fins={finList} accounts={accountList} jars={jars ?? []} invs={invs ?? []} cards={cards ?? []} plannedIncomes={plannedIncomes ?? []} movements={movements ?? []} cats={cats ?? []} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// OVERVIEW
function Overview({ fins, budgets, cards, accounts, jars, invs, accountsTotal, totalJars, totalInvs, futureCardExpense, patrimony, today }:
  { fins: Fin[]; budgets: Budget[]; cards: Card[]; accounts: Account[]; jars: Jar[]; invs: Inv[]; accountsTotal: number; totalJars: number; totalInvs: number; futureCardExpense: number; patrimony: number; today: string }) {
  const mk = monthKey();
  const monthStart = `${mk}-01`;
  const next = addMonth(mk, 1);
  const monthEnd = `${next}-01`;

  const monthFins = fins.filter(f => f.date >= monthStart && f.date < monthEnd);
  const monthIn = monthFins.filter(f => f.kind === "income").reduce((a, f) => a + Number(f.amount), 0);
  const monthOut = monthFins.filter(f => f.kind === "expense").reduce((a, f) => a + Number(f.amount), 0);

  const byCat = monthFins.filter(f => f.kind === "expense").reduce<Record<string, number>>((acc, f) => {
    const k = f.category || "—"; acc[k] = (acc[k] ?? 0) + Number(f.amount); return acc;
  }, {});
  const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const catMax = Math.max(1, ...catList.map(c => c[1]));

  const accBalances = accounts.map(ac => ({ ac, bal: balanceFor(ac, fins, today) }));
  const accMax = Math.max(1, ...accBalances.map(a => Math.abs(a.bal)));
  const biggest = accBalances.slice().sort((a, b) => b.bal - a.bal)[0];

  const jarMax = Math.max(1, ...jars.map(j => Number(j.current_amount)));
  const invMax = Math.max(1, ...invs.map(i => Number(i.current_amount)));
  const biggestInv = invs.slice().sort((a, b) => Number(b.current_amount) - Number(a.current_amount))[0];

  const insights: string[] = [];
  if (patrimony > 0 && totalInvs > 0) insights.push(`${Math.round((totalInvs / patrimony) * 100)}% do seu patrimônio está investido.`);
  for (const j of jars) {
    const goal = Number(j.goal ?? 0);
    if (goal > 0) {
      const pct = Math.round((Number(j.current_amount) / goal) * 100);
      if (pct >= 100) insights.push(`Sua reserva "${j.name}" já atingiu a meta.`);
      else if (pct >= 50) insights.push(`Sua reserva "${j.name}" já atingiu ${pct}% da meta.`);
    }
  }
  if (biggestInv) insights.push(`O ${biggestInv.name} representa seu maior investimento (${fmtBRL(Number(biggestInv.current_amount))}).`);
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
  if (biggest && accounts.length > 1) insights.push(`Sua conta com maior saldo é ${biggest.ac.name} (${fmtBRL(biggest.bal)}).`);
  insights.push(`Seu patrimônio total está em ${fmtBRL(patrimony)}.`);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Entradas do mês" value={fmtBRL(monthIn)} icon={TrendingUp} tint="mint" />
        <StatCard label="Saídas do mês" value={fmtBRL(monthOut)} icon={TrendingDown} tint="blush" />
        <StatCard label="Saldo do mês" value={fmtBRL(monthIn - monthOut)} tint="primary" />
        <StatCard label="Crédito futuro" value={fmtBRL(futureCardExpense)} icon={CreditCard} tint="sand" />
      </div>

      {accounts.length > 0 && (
        <div className="cozy-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-lg"><Landmark className="h-4 w-4 text-primary" />Distribuição entre contas</div>
            <span className="text-sm text-muted-foreground">{fmtBRL(accountsTotal)}</span>
          </div>
          <div className="space-y-3">
            {accBalances.map(({ ac, bal }) => (
              <div key={ac.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ac.color ?? "#7dd3fc" }} />
                    {ac.name} <span className="text-xs text-muted-foreground">· {ACCOUNT_TYPE_LABEL[ac.type] ?? ac.type}</span>
                  </span>
                  <span className={bal < 0 ? "text-rose-600" : "text-muted-foreground"}>{fmtBRL(bal)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-accent">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (Math.abs(bal) / accMax) * 100)}%`, background: ac.color ?? "var(--primary)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {jars.length > 0 && (
          <div className="cozy-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-display text-lg"><PiggyBank className="h-4 w-4 text-primary" />Distribuição por reserva</div>
              <span className="text-sm text-muted-foreground">{fmtBRL(totalJars)}</span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">As reservas separam parte do saldo das contas — não somam ao patrimônio.</p>
            <div className="space-y-3">
              {jars.map(j => {
                const cur = Number(j.current_amount);
                const acc = accounts.find(a => a.id === j.account_id);
                return (
                  <div key={j.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: j.color ?? "#7dd3fc" }} />
                        {j.name}{acc && <span className="text-xs text-muted-foreground">· {acc.name}</span>}
                      </span>
                      <span className="text-muted-foreground">{fmtBRL(cur)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-accent">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (cur / jarMax) * 100)}%`, background: j.color ?? "var(--primary)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {invs.length > 0 && (
          <div className="cozy-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-display text-lg"><LineChart className="h-4 w-4 text-primary" />Distribuição por investimento</div>
              <span className="text-sm text-muted-foreground">{fmtBRL(totalInvs)}</span>
            </div>
            <div className="space-y-3">
              {invs.map(i => {
                const cur = Number(i.current_amount);
                return (
                  <div key={i.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{i.name} <span className="text-xs text-muted-foreground">· {i.category ?? "outros"}</span></span>
                      <span className="text-muted-foreground">{fmtBRL(cur)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-accent">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (cur / invMax) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
// ACCOUNTS
function AccountsTab({ accounts, fins, jars, today, cats, cards = [] }: { accounts: Account[]; fins: Fin[]; jars: Jar[]; today: string; cats: Cat[]; cards?: Card[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const empty = { name: "", type: "corrente", initial_balance: 0, initial_balance_date: localDateKey(), color: "#7dd3fc", icon: "Wallet", notes: "" };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      name: editing.name, type: editing.type, initial_balance: Number(editing.initial_balance),
      initial_balance_date: editing.initial_balance_date || localDateKey(),
      color: editing.color ?? "#7dd3fc", icon: editing.icon ?? "Wallet", notes: editing.notes ?? "",
    } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const save = async () => {
    if (!user || !form.name) return;
    const { error } = editing
      ? await supabase.from("accounts").update(form).eq("id", editing.id)
      : await supabase.from("accounts").insert({ ...form, user_id: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["accounts"] });
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("accounts").delete().eq("id", confirmId);
    setConfirmId(null);
    qc.invalidateQueries({ queryKey: ["accounts"] });
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Nova conta</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar conta" : "Nova conta"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nubank, Inter, Carteira…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><Label>Saldo inicial</Label><Input type="number" step="0.01" value={form.initial_balance} onChange={e => setForm({ ...form, initial_balance: +e.target.value })} /></div>
            </div>
            <div>
              <Label>Data do saldo inicial</Label>
              <Input type="date" value={form.initial_balance_date} onChange={e => setForm({ ...form, initial_balance_date: e.target.value })} />
              <p className="mt-1 text-xs text-muted-foreground">Movimentações anteriores a essa data não afetam o saldo desta conta.</p>
            </div>
            <div><Label>Cor</Label><Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!accounts.length ? (
        <EmptyState title="Sem contas" description="Cadastre suas contas para organizar onde está cada parte do seu dinheiro." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map(ac => {
            const bal = balanceFor(ac, fins, today);
            const reserved = jars.filter(j => j.account_id === ac.id).reduce((a, j) => a + Number(j.current_amount), 0);
            const available = bal - reserved;
            const recent = fins
              .filter(f => f.account_id === ac.id || f.to_account_id === ac.id)
              .slice(0, 4);
            return (
              <div key={ac.id} className="cozy-card p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: ac.color ?? "#7dd3fc" }}>
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-display text-lg">{ac.name}</div>
                      <div className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABEL[ac.type] ?? ac.type}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <ImportStatementMenu account={ac} accounts={accounts} cats={cats} cards={cards} />
                    <button onClick={() => { setEditing(ac); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setConfirmId(ac.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className={`font-display text-2xl ${bal < 0 ? "text-rose-600" : ""}`}>{fmtBRL(bal)}</div>
                {reserved > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">Reservado: {fmtBRL(reserved)} · livre {fmtBRL(available)}</div>
                )}
                <div className="text-xs text-muted-foreground">Inicial: {fmtBRL(Number(ac.initial_balance))} · desde {formatDateBR(ac.initial_balance_date)}</div>
                {ac.notes && <p className="mt-2 text-sm text-muted-foreground">{ac.notes}</p>}
                {recent.length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Últimas movimentações</div>
                    <ul className="space-y-1.5">
                      {recent.map(r => {
                        const isOut = r.kind === "expense" || (r.kind === "transfer" && r.account_id === ac.id);
                        const isIn = r.kind === "income" || (r.kind === "transfer" && r.to_account_id === ac.id);
                        return (
                          <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate">{r.description || r.category || (r.kind === "transfer" ? "Transferência" : "—")}</span>
                            <span className={`shrink-0 ${isIn ? "text-emerald-600" : isOut ? "text-rose-600" : "text-muted-foreground"}`}>
                              {isIn ? "+" : isOut ? "−" : ""} {fmtBRL(Number(r.amount))}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove}
        title="Excluir conta?" description="As transações associadas continuarão registradas, mas ficarão sem conta vinculada." />
      <OFXImportsHistory accounts={accounts} cards={cards} />
    </div>
  );
}

// ============================================================
// TRANSACTIONS
const emptyTx = () => ({
  kind: "expense", amount: 0, category: "", description: "",
  date: localDateKey(), payment_method: "pix", installments: 1, notes: "",
  card_id: "" as string, account_id: "" as string, to_account_id: "" as string,
});

function Transactions({ fins, cards, accounts, cats, budgets }: { fins: Fin[]; cards: Card[]; accounts: Account[]; cats: Cat[]; budgets: Budget[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Fin | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense" | "credit" | "transfer">("all");
  const [accFilter, setAccFilter] = useState<string>("all");
  const [form, setForm] = useState(emptyTx());

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      kind: editing.kind, amount: Number(editing.amount), category: editing.category ?? "",
      description: editing.description ?? "", date: editing.date,
      payment_method: editing.payment_method ?? "pix", installments: editing.installments ?? 1,
      notes: editing.notes ?? "", card_id: editing.card_id ?? "",
      account_id: editing.account_id ?? "", to_account_id: editing.to_account_id ?? "",
    } : { ...emptyTx(), account_id: accounts[0]?.id ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const list = useMemo(() => {
    let l = fins;
    if (filter === "credit") l = l.filter(f => !!f.card_id);
    else if (filter !== "all") l = l.filter(f => f.kind === filter);
    if (accFilter !== "all") l = l.filter(f => f.account_id === accFilter || f.to_account_id === accFilter);
    return l;
  }, [fins, filter, accFilter]);

  // Saldo real por conta ao final de cada dia — sempre sobre a lista completa,
  // para não ser afetado pelos filtros de tipo/categoria da tela.
  const balancesByDay = useMemo(() => dailyBalances(accounts as any, fins as any), [accounts, fins]);

  const dayGroups = useMemo(() => {
    const map = new Map<string, Fin[]>();
    for (const f of list) {
      const arr = map.get(f.date) ?? [];
      arr.push(f);
      map.set(f.date, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [list]);

  const accName = (id: string | null) => accounts.find(a => a.id === id)?.name;

  const save = async () => {
    if (!user || !form.amount) return;
    if (form.kind === "transfer") {
      if (!form.account_id || !form.to_account_id) return toast.error("Escolha as contas de origem e destino.");
      if (form.account_id === form.to_account_id) return toast.error("As contas devem ser diferentes.");
    }
    const isCredit = form.kind === "expense" && form.payment_method === "crédito" && form.card_id;
    const card = isCredit ? cards.find(c => c.id === form.card_id) : null;
    const payload: Partial<Fin> & { user_id?: string } = {
      kind: form.kind, amount: form.amount,
      category: form.kind === "transfer" ? "transferência" : (form.category || null),
      description: form.description || null, date: form.date,
      payment_method: form.kind === "transfer" ? "transferência" : form.payment_method,
      installments: form.installments,
      notes: form.notes || null,
      card_id: isCredit ? form.card_id : null,
      paid: form.kind === "transfer" ? true : !isCredit,
      invoice_month: card ? invoiceMonthFor(form.date, card.closing_day) : null,
      account_id: form.account_id || null,
      to_account_id: form.kind === "transfer" ? (form.to_account_id || null) : null,
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
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["all", "Todos"], ["income", "Entradas"], ["expense", "Saídas"], ["transfer", "Transferências"], ["credit", "Crédito"],
          ] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1.5 text-xs ${filter === k ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"}`}>{l}</button>
          ))}
          {accounts.length > 0 && (
            <select value={accFilter} onChange={e => setAccFilter(e.target.value)}
              className="rounded-full bg-accent px-3 py-1.5 text-xs">
              <option value="all">Todas as contas</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Novo registro</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar" : "Novo registro"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(["expense", "income", "transfer"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })}
                  className={`rounded-xl border px-3 py-2 text-sm capitalize ${form.kind === k ? "border-primary bg-primary/15" : "border-border"}`}>
                  {k === "expense" ? "Saída" : k === "income" ? "Entrada" : "Transferência"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            </div>

            {form.kind === "transfer" ? (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>De</Label>
                  <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Selecione…</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div><Label>Para</Label>
                  <select value={form.to_account_id} onChange={e => setForm({ ...form, to_account_id: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Selecione…</option>
                    {accounts.filter(a => a.id !== form.account_id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Categoria</Label>
                    {(() => {
                      const wantedType: CatType = form.kind === "income" ? "receita" : "despesa";
                      const opts = cats.filter(c => !c.archived && c.type === wantedType);
                      return (
                        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <option value="">Selecione…</option>
                          {opts.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      );
                    })()}
                    {!cats.some(c => c.type === (form.kind === "income" ? "receita" : "despesa")) && (
                      <p className="mt-1 text-xs text-muted-foreground">Cadastre categorias na aba <strong>Planejamento → Categorias</strong>.</p>
                    )}
                  </div>
                  <div><Label>Forma</Label>
                    <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value, card_id: e.target.value === "crédito" ? form.card_id : "" })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {PAY.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                {form.category && (() => {
                  const mk = monthKey(new Date(form.date + "T00:00"));
                  const start = `${mk}-01`; const end = `${addMonth(mk, 1)}-01`;
                  const isIncome = form.kind === "income";
                  const matches = (name: string | null) => (name ?? "").trim().toLowerCase() === form.category.trim().toLowerCase();
                  const planned = budgets
                    .filter(b => b.month === mk && b.kind === "category" && matches(b.category))
                    .reduce((a, b) => a + Number(b.amount), 0);
                  const used = fins
                    .filter(f => f.kind === (isIncome ? "income" : "expense") && f.date >= start && f.date < end && matches(f.category))
                    .filter(f => editing ? f.id !== editing.id : true)
                    .reduce((a, f) => a + Number(f.amount), 0);
                  if (planned <= 0 && used <= 0) return null;
                  const available = planned - used;
                  const pct = planned > 0 ? Math.min(100, (used / planned) * 100) : 0;
                  return (
                    <div className="rounded-xl border bg-accent/30 p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium capitalize">{form.category}</span>
                        <span className="text-xs text-muted-foreground">{labelMonth(mk)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div><div className="text-xs text-muted-foreground">Orçado</div><div className="font-medium">{fmtBRL(planned)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Utilizado</div><div className="font-medium">{fmtBRL(used)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Disponível</div><div className={`font-medium ${available < 0 ? "text-rose-600" : "text-emerald-700"}`}>{fmtBRL(available)}</div></div>
                      </div>
                      {planned > 0 && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                          <div className={`h-full ${pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      {planned <= 0 && <p className="mt-2 text-xs text-muted-foreground">Sem orçamento para esta categoria neste mês.</p>}
                    </div>
                  );
                })()}
                <div>
                  <Label>Conta</Label>
                  <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Sem conta vinculada</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {!accounts.length && <p className="mt-1 text-xs text-muted-foreground">Cadastre uma conta na aba “Contas”.</p>}
                </div>
                {form.kind === "expense" && form.payment_method === "crédito" && (
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
              </>
            )}

            <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!list.length ? <EmptyState title="Sem registros" description="Comece registrando uma entrada, saída ou transferência." /> : (
        <div className="space-y-5">
          {dayGroups.map(([date, items]) => {
            const bal = balancesByDay.get(date);
            const dayIn = items.filter(x => x.kind === "income").reduce((a, x) => a + Number(x.amount), 0);
            const dayOut = items.filter(x => x.kind === "expense" && x.paid).reduce((a, x) => a + Number(x.amount), 0);
            return (
              <div key={date}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="font-display text-sm">{formatDateBR(date)}</span>
                  <span className="text-xs text-muted-foreground">
                    {dayIn > 0 && <span className="text-emerald-600">+{fmtBRL(dayIn)}</span>}
                    {dayIn > 0 && dayOut > 0 && " · "}
                    {dayOut > 0 && <span className="text-rose-600">−{fmtBRL(dayOut)}</span>}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((x, i) => {
            const isCredit = !!x.card_id;
            const isTransfer = x.kind === "transfer";
            const isPat = isTransfer && x.category === "transferência patrimonial";
            const card = cards.find(c => c.id === x.card_id);
            const from = accName(x.account_id);
            const to = accName(x.to_account_id);
            return (
              <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.015 }} className="cozy-card flex items-center gap-3 p-4">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${isTransfer ? "bg-accent" : x.kind === "income" ? "bg-mint/40" : isCredit ? "bg-accent" : "bg-blush/40"}`}>
                  {isTransfer ? <ArrowRightLeft className="h-4 w-4" /> : x.kind === "income" ? <TrendingUp className="h-4 w-4" /> : isCredit ? <CreditCard className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{x.description || (isTransfer ? `${from ?? "?"} → ${to ?? "?"}` : x.category || "Registro")}</span>
                    {isPat && (
                      <>
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">Aplicação</span>
                        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-700">Transferência patrimonial</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDateBR(x.date)}</span>
                    {!isTransfer && x.category && <span>· {x.category}</span>}
                    {!isTransfer && x.payment_method && <span>· {x.payment_method}</span>}
                    {!isTransfer && from && <span>· {from}</span>}
                    {isTransfer && <span>· {from ? `${from} → ` : ""}{to ?? "?"}</span>}
                    {card && <span>· {card.name}</span>}
                    {isCredit && !x.paid && x.invoice_month && <span className="rounded-full bg-amber-200/60 px-2 text-[10px] text-amber-900">fatura {labelMonth(x.invoice_month)}</span>}
                  </div>
                </div>
                <div className={`font-display text-lg ${isTransfer ? "text-muted-foreground" : x.kind === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                  {isTransfer ? "↔" : x.kind === "income" ? "+" : "−"} {fmtBRL(Number(x.amount))}
                </div>
                <button onClick={() => { setEditing(x); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setConfirmId(x.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </motion.div>
            );
                  })}
                </div>
                {bal && accounts.length > 0 && (
                  <div className="mt-2 rounded-xl bg-accent/40 px-4 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Saldo do dia {accFilter !== "all" ? `· ${accName(accFilter) ?? ""}` : "· todas as contas"}</span>
                      <span className="font-display text-sm text-foreground">
                        {fmtBRL(accFilter !== "all" ? (bal.per[accFilter] ?? 0) : bal.total)}
                      </span>
                    </div>
                    {accFilter === "all" && accounts.length > 1 && (
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        {accounts.map(a => <span key={a.id}>{a.name}: {fmtBRL(bal.per[a.id] ?? 0)}</span>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
function CardsTab({ cards, fins, accounts, cats }: { cards: Card[]; fins: Fin[]; accounts: Account[]; cats: Cat[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [payingCard, setPayingCard] = useState<{ card: Card; invoice: string; total: number } | null>(null);
  const [payAccount, setPayAccount] = useState<string>("");
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

  const confirmPayInvoice = async () => {
    if (!payingCard) return;
    const { card, invoice, total } = payingCard;
    const items = fins.filter(f => f.card_id === card.id && !f.paid && f.invoice_month === invoice);
    if (!items.length) { setPayingCard(null); return; }
    const due = dueDateOf(invoice, card.due_day);
    const { error: e1 } = await supabase.from("finances").update({ paid: true }).in("id", items.map(i => i.id));
    if (e1) return toast.error(e1.message);
    await supabase.from("finances").insert({
      user_id: user!.id, kind: "expense", amount: total, category: "fatura",
      description: `Fatura ${card.name} (${labelMonth(invoice)})`, date: due,
      payment_method: "débito", installments: 1, paid: true,
      account_id: payAccount || null,
    });
    toast.success("Fatura paga.");
    setPayingCard(null); setPayAccount("");
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

      <Dialog open={!!payingCard} onOpenChange={(o) => !o && setPayingCard(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Pagar fatura</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Total: <strong>{payingCard && fmtBRL(payingCard.total)}</strong></p>
            <div>
              <Label>Conta de origem</Label>
              <select value={payAccount} onChange={e => setPayAccount(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Sem conta vinculada</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <Button onClick={confirmPayInvoice} className="w-full rounded-full">Confirmar pagamento</Button>
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
                  {curTotal > 0 && <Button variant="secondary" onClick={() => { setPayingCard({ card: c, invoice: mk, total: curTotal }); setPayAccount(accounts[0]?.id ?? ""); }} className="w-full rounded-full"><CheckCircle2 className="mr-1 h-4 w-4" />Pagar fatura atual</Button>}
                  <div className="pt-1"><OFXCardImportButton card={c} cats={cats} /></div>
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
function Jars({ jars, accounts }: { jars: Jar[]; accounts: Account[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Jar | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [move, setMove] = useState<{ jar: Jar; mode: "deposit" | "withdraw" | "transfer" } | null>(null);
  const [moveAmt, setMoveAmt] = useState(0);
  const [moveTo, setMoveTo] = useState("");
  const [moveAcc, setMoveAcc] = useState("");
  const empty = { name: "", current_amount: 0, goal: 0, color: "#7dd3fc", notes: "", account_id: "" };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      name: editing.name, current_amount: Number(editing.current_amount), goal: Number(editing.goal ?? 0),
      color: editing.color ?? "#7dd3fc", notes: editing.notes ?? "", account_id: editing.account_id ?? "",
    } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Default the account when opening the deposit/withdraw dialog
  useEffect(() => {
    if (move && move.mode !== "transfer") setMoveAcc(move.jar.account_id ?? accounts[0]?.id ?? "");
    else setMoveAcc("");
  }, [move, accounts]);

  const save = async () => {
    if (!user || !form.name) return;
    const payload = {
      name: form.name, current_amount: form.current_amount, goal: form.goal || null,
      color: form.color, notes: form.notes || null, account_id: form.account_id || null,
    };
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
    const today = localDateKey();
    if (move.mode === "deposit") {
      await supabase.from("savings_jars").update({ current_amount: Number(jar.current_amount) + moveAmt }).eq("id", jar.id);
    } else if (move.mode === "withdraw") {
      if (!moveAcc) return toast.error("Escolha a conta de destino do resgate.");
      await supabase.from("savings_jars").update({ current_amount: Math.max(0, Number(jar.current_amount) - moveAmt) }).eq("id", jar.id);
      // Patrimonial transfer: credits the destination account without counting as income/expense
      await supabase.from("finances").insert({
        user_id: user!.id, kind: "transfer", amount: moveAmt,
        account_id: null, to_account_id: moveAcc,
        category: "transferência patrimonial",
        description: `Resgate de Reserva: ${jar.name}`,
        date: today, payment_method: "transferência", paid: true,
      });
      qc.invalidateQueries({ queryKey: ["finances"] });
      toast.success("Resgate registrado no extrato da conta.");
    } else {
      if (!moveTo) return toast.error("Escolha a reserva de destino.");
      const target = jars.find(j => j.id === moveTo);
      if (!target) return;
      await supabase.from("savings_jars").update({ current_amount: Math.max(0, Number(jar.current_amount) - moveAmt) }).eq("id", jar.id);
      await supabase.from("savings_jars").update({ current_amount: Number(target.current_amount) + moveAmt }).eq("id", target.id);
    }
    await supabase.from("savings_movements").insert({
      user_id: user!.id, jar_id: jar.id, kind: move.mode === "transfer" ? "transfer_out" : move.mode,
      amount: moveAmt, date: today,
    });
    setMove(null); setMoveAmt(0); setMoveTo(""); setMoveAcc("");
    qc.invalidateQueries({ queryKey: ["jars"] });
    qc.invalidateQueries({ queryKey: ["savings_movements"] });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">As reservas separam parte do saldo de uma conta para um objetivo. Elas não criam dinheiro novo nem somam ao patrimônio.</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="shrink-0 rounded-full"><Plus className="mr-1 h-4 w-4" />Nova reserva</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar reserva" : "Nova reserva"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input list="jar-name-suggestions" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Emergência, Viagem, Casa…" />
              <datalist id="jar-name-suggestions">{RESERVE_CAT_SUGGESTIONS.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor reservado</Label><Input type="number" step="0.01" value={form.current_amount} onChange={e => setForm({ ...form, current_amount: +e.target.value })} /></div>
              <div><Label>Meta (opcional)</Label><Input type="number" step="0.01" value={form.goal} onChange={e => setForm({ ...form, goal: +e.target.value })} /></div>
            </div>
            <div>
              <Label>Conta vinculada</Label>
              <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Sem conta vinculada</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">A reserva apenas marca que parte do saldo desta conta está separada para um objetivo.</p>
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
            {move?.mode === "deposit" ? "Reservar valor" : move?.mode === "withdraw" ? "Liberar / resgatar valor" : "Transferir entre reservas"}
            {" "}— {move?.jar.name}
          </DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Valor</Label><Input type="number" step="0.01" value={moveAmt} onChange={e => setMoveAmt(+e.target.value)} /></div>
            {move?.mode === "transfer" && (
              <div>
                <Label>Para a reserva</Label>
                <select value={moveTo} onChange={e => setMoveTo(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Selecione…</option>
                  {jars.filter(j => j.id !== move.jar.id).map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
            )}
            {move?.mode === "withdraw" && (
              <div>
                <Label>Conta de destino</Label>
                <select value={moveAcc} onChange={e => setMoveAcc(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Selecione a conta…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">O valor aparecerá no extrato da conta como <strong>Transferência patrimonial</strong> — não conta como nova receita.</p>
              </div>
            )}
            <Button onClick={applyMove} className="w-full rounded-full">Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>


      {!jars.length ? <EmptyState title="Sem reservas" description="Crie separações para suas metas: emergência, viagem, casa, presente…" /> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jars.map((j) => {
            const cur = Number(j.current_amount);
            const goal = Number(j.goal ?? 0);
            const pct = goal ? (cur / goal) * 100 : 0;
            const acc = accounts.find(a => a.id === j.account_id);
            return (
              <div key={j.id} className="cozy-card p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: j.color ?? "#7dd3fc" }}><PiggyBank className="h-4 w-4" /></div>
                    <div>
                      <div className="font-display text-lg">{j.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {acc ? `em ${acc.name}` : "sem conta vinculada"}
                        {goal ? ` · meta ${fmtBRL(goal)}` : ""}
                      </div>
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
                  <Button size="sm" variant="secondary" className="flex-1 rounded-full" onClick={() => { setMove({ jar: j, mode: "deposit" }); setMoveAmt(0); }}>+ Reservar</Button>
                  <Button size="sm" variant="secondary" className="flex-1 rounded-full" onClick={() => { setMove({ jar: j, mode: "withdraw" }); setMoveAmt(0); }}>− Liberar</Button>
                  <Button size="sm" variant="ghost" className="rounded-full" onClick={() => { setMove({ jar: j, mode: "transfer" }); setMoveAmt(0); }} title="Transferir"><ArrowRightLeft className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove} title="Excluir reserva?" />
    </div>
  );
}

// ============================================================
// INVESTMENTS
function Investments({ invs, accounts }: { invs: Inv[]; accounts: Account[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Inv | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const emptyInv = { name: "", category: "outros", institution: "", invested_amount: 0, current_amount: 0, invested_date: localDateKey(), notes: "" };
  const [form, setForm] = useState(emptyInv);

  // Redeem state
  const [redeem, setRedeem] = useState<Inv | null>(null);
  const [redeemAmt, setRedeemAmt] = useState(0);
  const [redeemAcc, setRedeemAcc] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      name: editing.name, category: editing.category ?? "outros",
      institution: editing.institution ?? "",
      invested_amount: Number(editing.invested_amount), current_amount: Number(editing.current_amount),
      invested_date: editing.invested_date ?? localDateKey(),
      notes: editing.notes ?? "",
    } : emptyInv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  useEffect(() => {
    if (redeem) { setRedeemAmt(0); setRedeemAcc(accounts[0]?.id ?? ""); }
  }, [redeem, accounts]);

  const save = async () => {
    if (!user || !form.name) return;
    const payload = {
      name: form.name, category: form.category,
      institution: form.institution || null,
      invested_amount: form.invested_amount, current_amount: form.current_amount,
      invested_date: form.invested_date || null,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("investments").update(payload).eq("id", editing.id)
      : await supabase.from("investments").insert({ ...payload, user_id: user.id });
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

  const applyRedeem = async () => {
    if (!redeem || !user) return;
    const inv = redeem;
    const cur = Number(inv.current_amount);
    if (redeemAmt <= 0) return toast.error("Informe o valor do resgate.");
    if (redeemAmt > cur) return toast.error("Valor maior que o disponível no investimento.");
    if (!redeemAcc) return toast.error("Escolha a conta de destino.");
    const ratio = cur > 0 ? (cur - redeemAmt) / cur : 0;
    const newCur = cur - redeemAmt;
    const newInvested = Number(inv.invested_amount) * ratio;
    await supabase.from("investments").update({
      current_amount: newCur, invested_amount: newInvested,
    }).eq("id", inv.id);
    await supabase.from("finances").insert({
      user_id: user.id, kind: "transfer", amount: redeemAmt,
      account_id: null, to_account_id: redeemAcc,
      category: "transferência patrimonial",
      description: `Resgate de Investimento: ${inv.name}`,
      date: localDateKey(), payment_method: "transferência", paid: true,
    });
    toast.success("Resgate registrado no extrato da conta.");
    setRedeem(null);
    qc.invalidateQueries({ queryKey: ["investments"] });
    qc.invalidateQueries({ queryKey: ["finances"] });
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
            <div>
              <Label>Nome</Label>
              <Input list="invest-name-suggestions" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tesouro Selic 2029…" />
              <datalist id="invest-name-suggestions">
                {INVEST_CAT_SUGGESTIONS.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Instituição</Label><Input value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} placeholder="Nubank, XP, Inter…" /></div>
              <div><Label>Tipo</Label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {INV_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor aplicado</Label><Input type="number" step="0.01" value={form.invested_amount} onChange={e => setForm({ ...form, invested_amount: +e.target.value })} /></div>
              <div><Label>Valor atual</Label><Input type="number" step="0.01" value={form.current_amount} onChange={e => setForm({ ...form, current_amount: +e.target.value })} /></div>
            </div>
            <div><Label>Data da aplicação</Label><Input type="date" value={form.invested_date} onChange={e => setForm({ ...form, invested_date: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!redeem} onOpenChange={(o) => !o && setRedeem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Resgatar — {redeem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl bg-accent/40 px-3 py-2 text-sm text-muted-foreground">
              Disponível: <strong>{fmtBRL(Number(redeem?.current_amount ?? 0))}</strong>
            </div>
            <div><Label>Valor do resgate</Label><Input type="number" step="0.01" value={redeemAmt} onChange={e => setRedeemAmt(+e.target.value)} /></div>
            <div>
              <Label>Conta de destino</Label>
              <select value={redeemAcc} onChange={e => setRedeemAcc(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecione a conta…</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">O valor aparecerá no extrato da conta como <strong>Transferência patrimonial</strong> — não conta como nova receita.</p>
            </div>
            <Button onClick={applyRedeem} className="w-full rounded-full">Confirmar resgate</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!invs.length ? <EmptyState title="Sem investimentos" description="Registre seus investimentos para acompanhar o patrimônio." /> : (
        <div className="space-y-2">
          {invs.map(i => {
            const g = Number(i.current_amount) - Number(i.invested_amount);
            const gp = i.invested_amount ? (g / Number(i.invested_amount)) * 100 : 0;
            return (
              <div key={i.id} className="cozy-card flex flex-wrap items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-sand/60"><LineChart className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {i.category}
                    {i.institution ? ` · ${i.institution}` : ""}
                    {` · investido ${fmtBRL(Number(i.invested_amount))}`}
                    {i.invested_date ? ` · desde ${formatDateBR(i.invested_date)}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg">{fmtBRL(Number(i.current_amount))}</div>
                  <div className={`text-xs ${g >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{g >= 0 ? "+" : ""}{gp.toFixed(2)}%</div>
                </div>
                <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setRedeem(i)} disabled={!accounts.length} title={!accounts.length ? "Cadastre uma conta primeiro" : "Resgatar para uma conta"}>
                  <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />Resgatar
                </Button>
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
// PLANNING (receitas previstas + orçamento + planejado x realizado)
type BudgetKind = "category" | "card" | "reserve" | "investment";

function PlanningTab({
  budgets, fins, accounts, jars, invs, cards, plannedIncomes, movements, cats,
}: {
  budgets: Budget[]; fins: Fin[]; accounts: Account[]; jars: Jar[]; invs: Inv[]; cards: Card[];
  plannedIncomes: PlannedIncome[]; movements: Movement[]; cats: Cat[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthKey());
  const start = `${month}-01`;
  const end = `${addMonth(month, 1)}-01`;

  // ---------- planned incomes ----------
  const monthIncomes = plannedIncomes.filter(p => p.month === month);
  const totalIncomePlanned = monthIncomes.reduce((a, p) => a + Number(p.amount), 0);
  const totalIncomeReceived = monthIncomes.filter(p => p.received).reduce((a, p) => a + Number(p.amount), 0);
  const realIncomeMonth = fins.filter(f => f.kind === "income" && f.date >= start && f.date < end).reduce((a, f) => a + Number(f.amount), 0);

  const [incOpen, setIncOpen] = useState(false);
  const [incEditing, setIncEditing] = useState<PlannedIncome | null>(null);
  const incEmpty = { description: "", category: "salário", amount: 0, expected_date: `${month}-05`, account_id: accounts[0]?.id ?? null, received: false, notes: "" };
  const [incForm, setIncForm] = useState<any>(incEmpty);

  useEffect(() => {
    if (!incOpen) return;
    setIncForm(incEditing ? {
      description: incEditing.description, category: incEditing.category ?? "",
      amount: Number(incEditing.amount), expected_date: incEditing.expected_date ?? `${month}-05`,
      account_id: incEditing.account_id, received: incEditing.received, notes: incEditing.notes ?? "",
    } : { ...incEmpty, expected_date: `${month}-05` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incOpen, incEditing, month]);

  const saveIncome = async () => {
    if (!user || !incForm.description) return;
    const payload = { ...incForm, month, user_id: user.id };
    const { error } = incEditing
      ? await supabase.from("planned_incomes").update(payload).eq("id", incEditing.id)
      : await supabase.from("planned_incomes").insert(payload);
    if (error) return toast.error(error.message);
    setIncOpen(false); setIncEditing(null);
    qc.invalidateQueries({ queryKey: ["planned_incomes"] });
  };
  const toggleReceived = async (p: PlannedIncome) => {
    await supabase.from("planned_incomes").update({ received: !p.received }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["planned_incomes"] });
  };
  const removeIncome = async (id: string) => {
    await supabase.from("planned_incomes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["planned_incomes"] });
  };

  // ---------- budgets ----------
  const monthBudgets = budgets.filter(b => b.month === month);
  const totalRow = monthBudgets.find(b => b.kind === "category" && !b.category && !b.ref_id);
  const catBudgets = monthBudgets.filter(b => b.kind === "category" && b.category);
  const cardBudgets = monthBudgets.filter(b => b.kind === "card");
  const reserveBudgets = monthBudgets.filter(b => b.kind === "reserve");
  const investBudgets = monthBudgets.filter(b => b.kind === "investment");

  const monthExpenses = fins.filter(f => f.kind === "expense" && f.date >= start && f.date < end);
  const spentTotal = monthExpenses.reduce((a, f) => a + Number(f.amount), 0);
  const spentByCat = monthExpenses.reduce<Record<string, number>>((acc, f) => {
    const k = (f.category || "—").toLowerCase(); acc[k] = (acc[k] ?? 0) + Number(f.amount); return acc;
  }, {});
  const spentByCard = fins.filter(f => f.kind === "expense" && f.card_id && (f.invoice_month === month || (!f.invoice_month && f.date >= start && f.date < end)))
    .reduce<Record<string, number>>((acc, f) => { acc[f.card_id!] = (acc[f.card_id!] ?? 0) + Number(f.amount); return acc; }, {});
  const depositByJar = movements.filter(m => m.kind === "deposit" && m.date >= start && m.date < end)
    .reduce<Record<string, number>>((acc, m) => { acc[m.jar_id] = (acc[m.jar_id] ?? 0) + Number(m.amount); return acc; }, {});

  const realizedFor = (b: Budget): number => {
    if (b.kind === "category") return spentByCat[(b.category ?? "").toLowerCase()] ?? 0;
    if (b.kind === "card" && b.ref_id) return spentByCard[b.ref_id] ?? 0;
    if (b.kind === "reserve" && b.ref_id) return depositByJar[b.ref_id] ?? 0;
    if (b.kind === "investment") return Number(b.realized_amount ?? 0);
    return 0;
  };

  // ---------- mutations: budgets ----------
  const upsertBudget = async (payload: Partial<Budget> & { kind: BudgetKind; amount: number; category?: string | null; ref_id?: string | null; label?: string | null }) => {
    if (!user) return;
    const existing = budgets.find(b => b.month === month && b.kind === payload.kind
      && (b.category ?? null) === (payload.category ?? null) && (b.ref_id ?? null) === (payload.ref_id ?? null));
    const body: any = { user_id: user.id, month, ...payload };
    const { error } = existing
      ? await supabase.from("budgets").update(body).eq("id", existing.id)
      : await supabase.from("budgets").insert(body);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };
  const updateBudget = async (id: string, patch: any) => {
    await supabase.from("budgets").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };
  const removeBudget = async (id: string) => {
    await supabase.from("budgets").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  // ---------- add budget dialog ----------
  const [bOpen, setBOpen] = useState(false);
  const [catMgrOpen, setCatMgrOpen] = useState(false);
  const [bForm, setBForm] = useState<{ kind: BudgetKind; category: string; ref_id: string; amount: number; label: string }>({ kind: "category", category: "", ref_id: "", amount: 0, label: "" });
  useEffect(() => { if (bOpen) setBForm({ kind: "category", category: "", ref_id: "", amount: 0, label: "" }); }, [bOpen]);

  const saveNewBudget = async () => {
    if (bForm.amount <= 0) return toast.error("Informe um valor.");
    if (bForm.kind === "category" && !bForm.category) return toast.error("Informe a categoria.");
    if ((bForm.kind === "card" || bForm.kind === "reserve" || bForm.kind === "investment") && !bForm.ref_id) return toast.error("Selecione um item.");
    await upsertBudget({
      kind: bForm.kind,
      amount: bForm.amount,
      category: bForm.kind === "category" ? bForm.category.toLowerCase() : null,
      ref_id: bForm.kind === "category" ? null : bForm.ref_id,
      label: bForm.label || null,
    });
    setBOpen(false);
  };

  // ---------- aggregates ----------
  const sum = (arr: Budget[]) => arr.reduce((a, b) => a + Number(b.amount), 0);
  const sumReal = (arr: Budget[]) => arr.reduce((a, b) => a + realizedFor(b), 0);
  const plannedCats = sum(catBudgets);
  const plannedCards = sum(cardBudgets);
  const plannedReserves = sum(reserveBudgets);
  const plannedInvs = sum(investBudgets);
  const totalPlanned = plannedCats + plannedCards + plannedReserves + plannedInvs;
  const freeBalance = totalIncomePlanned - totalPlanned;
  const realized = sumReal(catBudgets) + sumReal(cardBudgets) + sumReal(reserveBudgets) + sumReal(investBudgets);
  const usedPct = totalIncomePlanned > 0 ? Math.round((totalPlanned / totalIncomePlanned) * 100) : 0;
  const economy = realIncomeMonth - spentTotal;

  // ---------- alerts / insights ----------
  const alerts: { tone: "warn" | "good" | "info"; text: string }[] = [];
  if (totalIncomePlanned > 0 && totalPlanned > totalIncomePlanned) alerts.push({ tone: "warn", text: `Seu planejamento (${fmtBRL(totalPlanned)}) ultrapassa a renda prevista (${fmtBRL(totalIncomePlanned)}).` });
  if (totalIncomePlanned > 0 && usedPct <= 90 && totalPlanned > 0) alerts.push({ tone: "info", text: `Seu planejamento utiliza ${usedPct}% da renda prevista.` });
  if (realIncomeMonth > 0 && plannedInvs > 0) {
    const pctInv = Math.round((sumReal(investBudgets) / realIncomeMonth) * 100);
    if (pctInv > 0) alerts.push({ tone: "good", text: `Você investiu ${pctInv}% da sua renda este mês.` });
  }
  for (const b of [...catBudgets, ...cardBudgets, ...reserveBudgets, ...investBudgets]) {
    const r = realizedFor(b); const amt = Number(b.amount);
    if (amt <= 0) continue;
    const pct = (r / amt) * 100;
    const name = b.label || b.category || (b.kind === "card" ? cards.find(c => c.id === b.ref_id)?.name : b.kind === "reserve" ? jars.find(j => j.id === b.ref_id)?.name : invs.find(i => i.id === b.ref_id)?.name) || "—";
    if (pct >= 100 && r > amt) alerts.push({ tone: "warn", text: `Você gastou ${fmtBRL(r - amt)} acima do planejado em ${name}.` });
    else if (pct >= 80 && pct < 100) alerts.push({ tone: "info", text: `${name} já consumiu ${Math.round(pct)}% do planejado.` });
    else if (b.kind === "category" && pct < 100 && r > 0 && r < amt && spentTotal > 0) {
      // economy on a category
      // limited noise: only show when at least 20% economized
      if ((amt - r) / amt >= 0.2) alerts.push({ tone: "good", text: `Você economizou ${fmtBRL(amt - r)} em ${name}.` });
    }
    if (b.kind === "reserve" && r >= amt && amt > 0) alerts.push({ tone: "good", text: `Sua reserva ${name} recebeu o valor planejado.` });
  }

  const colorFor = (pct: number) => pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";

  const renderBudgetRow = (b: Budget) => {
    const r = realizedFor(b); const amt = Number(b.amount); const pct = amt ? (r / amt) * 100 : 0;
    const diff = amt - r;
    const name = b.label || b.category
      || (b.kind === "card" ? cards.find(c => c.id === b.ref_id)?.name
        : b.kind === "reserve" ? jars.find(j => j.id === b.ref_id)?.name
        : b.kind === "investment" ? invs.find(i => i.id === b.ref_id)?.name
        : "—") || "—";
    return (
      <div key={b.id} className="cozy-card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="font-medium capitalize">{name}</div>
          <div className="flex items-center gap-2">
            {b.kind === "investment" && (
              <Input type="number" step="0.01" className="w-28" placeholder="Realizado"
                value={b.realized_amount ?? ""} onChange={(e) => updateBudget(b.id, { realized_amount: e.target.value === "" ? null : +e.target.value })} />
            )}
            <Input type="number" step="0.01" className="w-28" value={b.amount}
              onChange={(e) => updateBudget(b.id, { amount: +e.target.value })} />
            <button onClick={() => removeBudget(b.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
          <span>Realizado {fmtBRL(r)} de {fmtBRL(amt)}</span>
          <span className={diff < 0 ? "text-rose-600" : "text-muted-foreground"}>{diff >= 0 ? `Sobra ${fmtBRL(diff)}` : `Excedeu ${fmtBRL(-diff)}`} · {Math.round(pct)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-accent"><div className={`h-full ${colorFor(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
      </div>
    );
  };

  const sectionEmpty = (label: string) => <p className="text-sm text-muted-foreground">Nada planejado em {label} ainda.</p>;

  return (
    <div className="space-y-6">
      {/* Month switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(addMonth(month, -1))} className="rounded-full bg-accent px-3 py-1 text-sm">←</button>
          <div className="font-display text-lg capitalize">{labelMonth(month)}</div>
          <button onClick={() => setMonth(addMonth(month, 1))} className="rounded-full bg-accent px-3 py-1 text-sm">→</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCatMgrOpen(true)} variant="outline" className="rounded-full"><Plus className="mr-1 h-4 w-4" />Categorias</Button>
          <Button onClick={() => { setIncEditing(null); setIncOpen(true); }} variant="outline" className="rounded-full"><Plus className="mr-1 h-4 w-4" />Receita prevista</Button>
          <Button onClick={() => setBOpen(true)} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Item no plano</Button>
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Receita prevista" value={fmtBRL(totalIncomePlanned)} icon={TrendingUp} tint="mint" />
        <StatCard label="Receita recebida" value={fmtBRL(totalIncomeReceived || realIncomeMonth)} icon={CheckCircle2} tint="primary"
          hint={totalIncomePlanned > 0 ? `${Math.round(((totalIncomeReceived || realIncomeMonth) / totalIncomePlanned) * 100)}% do previsto` : undefined} />
        <StatCard label="Total planejado" value={fmtBRL(totalPlanned)} icon={Target} tint="sand"
          hint={totalIncomePlanned > 0 ? `${usedPct}% da renda` : undefined} />
        <StatCard label={freeBalance >= 0 ? "Saldo livre" : "Excedendo a renda"} value={fmtBRL(Math.abs(freeBalance))} icon={Sparkles}
          tint={freeBalance >= 0 ? "blush" : "blush"} />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total gasto no mês" value={fmtBRL(spentTotal)} icon={TrendingDown} tint="blush" />
        <StatCard label="Economia do mês" value={fmtBRL(economy)} icon={PiggyBank} tint="mint"
          hint={realIncomeMonth > 0 ? `${Math.round((economy / realIncomeMonth) * 100)}% da renda` : undefined} />
        <StatCard label="Planejado realizado" value={fmtBRL(realized)} tint="primary"
          hint={totalPlanned > 0 ? `${Math.round((realized / totalPlanned) * 100)}% do plano` : undefined} />
        <StatCard label="Faltam para a renda" value={fmtBRL(Math.max(0, totalIncomePlanned - (totalIncomeReceived || realIncomeMonth)))} tint="sand" />
      </div>

      {/* Receitas previstas */}
      <div className="cozy-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg"><TrendingUp className="h-4 w-4 text-primary" />Receitas previstas</div>
          <span className="text-sm text-muted-foreground">Previsto {fmtBRL(totalIncomePlanned)} · Recebido {fmtBRL(totalIncomeReceived)}</span>
        </div>
        {!monthIncomes.length ? (
          <p className="text-sm text-muted-foreground">Cadastre suas receitas previstas (salário, VR/VA, freelances…) para começar o planejamento.</p>
        ) : (
          <div className="space-y-2">
            {monthIncomes.map(p => {
              const acc = accounts.find(a => a.id === p.account_id);
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent/40 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleReceived(p)} className={`grid h-7 w-7 place-items-center rounded-full border ${p.received ? "border-emerald-500 bg-emerald-500/15 text-emerald-700" : "border-muted-foreground/30 text-muted-foreground"}`}>
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <div>
                      <div className="font-medium">{p.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.category && <>{p.category} · </>}
                        {p.expected_date && <>{formatDateBR(p.expected_date)} </>}
                        {acc && <> · {acc.name}</>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${p.received ? "text-emerald-700" : ""}`}>{fmtBRL(Number(p.amount))}</span>
                    <button onClick={() => { setIncEditing(p); setIncOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => removeIncome(p.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Total budget */}
      <div className="cozy-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg"><Target className="h-4 w-4 text-primary" />Teto de gastos do mês (opcional)</div>
          <Input type="number" step="0.01" className="w-40" value={totalRow?.amount ?? 0}
            onChange={(e) => upsertBudget({ kind: "category", category: null, amount: +e.target.value })} />
        </div>
        {totalRow && Number(totalRow.amount) > 0 && (() => {
          const pct = (spentTotal / Number(totalRow.amount)) * 100;
          return (
            <div>
              <div className="mb-1 flex justify-between text-sm"><span>{fmtBRL(spentTotal)} de {fmtBRL(Number(totalRow.amount))}</span><span className={pct >= 100 ? "text-rose-600" : "text-muted-foreground"}>{Math.round(pct)}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-accent"><div className={`h-full ${colorFor(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
            </div>
          );
        })()}
      </div>

      {/* Sections by kind */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-lg"><Target className="h-4 w-4 text-primary" />Categorias</div>
            <span className="text-sm text-muted-foreground">{fmtBRL(sumReal(catBudgets))} / {fmtBRL(plannedCats)}</span>
          </div>
          {catBudgets.length ? catBudgets.map(renderBudgetRow) : sectionEmpty("categorias")}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-lg"><CreditCard className="h-4 w-4 text-primary" />Cartões</div>
            <span className="text-sm text-muted-foreground">{fmtBRL(sumReal(cardBudgets))} / {fmtBRL(plannedCards)}</span>
          </div>
          {cardBudgets.length ? cardBudgets.map(renderBudgetRow) : sectionEmpty("cartões")}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-lg"><PiggyBank className="h-4 w-4 text-primary" />Reservas</div>
            <span className="text-sm text-muted-foreground">{fmtBRL(sumReal(reserveBudgets))} / {fmtBRL(plannedReserves)}</span>
          </div>
          {reserveBudgets.length ? reserveBudgets.map(renderBudgetRow) : sectionEmpty("reservas")}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-lg"><LineChart className="h-4 w-4 text-primary" />Investimentos</div>
            <span className="text-sm text-muted-foreground">{fmtBRL(sumReal(investBudgets))} / {fmtBRL(plannedInvs)}</span>
          </div>
          {investBudgets.length ? investBudgets.map(renderBudgetRow) : sectionEmpty("investimentos")}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="cozy-card p-5">
          <div className="mb-3 flex items-center gap-2 font-display text-lg"><Sparkles className="h-4 w-4 text-primary" />Alertas e insights</div>
          <ul className="space-y-2 text-sm">
            {alerts.map((a, i) => (
              <li key={i} className={`rounded-xl px-3 py-2 ${a.tone === "warn" ? "bg-rose-500/10 text-rose-700" : a.tone === "good" ? "bg-emerald-500/10 text-emerald-700" : "bg-accent/50"}`}>{a.text}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Dialog: planned income */}
      <Dialog open={incOpen} onOpenChange={setIncOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{incEditing ? "Editar receita prevista" : "Nova receita prevista"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição</Label><Input value={incForm.description} onChange={e => setIncForm({ ...incForm, description: e.target.value })} placeholder="Salário, VR, freelance…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Input list="income-cat-suggestions" value={incForm.category ?? ""} onChange={e => setIncForm({ ...incForm, category: e.target.value })} placeholder="Salário, Benefício…" />
                <datalist id="income-cat-suggestions">
                  {INCOME_CAT_SUGGESTIONS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div><Label>Valor previsto</Label><Input type="number" step="0.01" value={incForm.amount} onChange={e => setIncForm({ ...incForm, amount: +e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data prevista</Label><Input type="date" value={incForm.expected_date ?? ""} onChange={e => setIncForm({ ...incForm, expected_date: e.target.value })} /></div>
              <div>
                <Label>Conta de destino</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={incForm.account_id ?? ""} onChange={e => setIncForm({ ...incForm, account_id: e.target.value || null })}>
                  <option value="">—</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input id="received" type="checkbox" checked={incForm.received} onChange={e => setIncForm({ ...incForm, received: e.target.checked })} />
              <Label htmlFor="received">Já recebida</Label>
            </div>
            <div><Label>Observações</Label><Textarea value={incForm.notes ?? ""} onChange={e => setIncForm({ ...incForm, notes: e.target.value })} /></div>
            <Button onClick={saveIncome} className="w-full rounded-full">{incEditing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: new budget item */}
      <Dialog open={bOpen} onOpenChange={setBOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Novo item no plano</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo da categoria</Label>
              <div className="grid grid-cols-4 gap-2">
                {(["category", "card", "reserve", "investment"] as BudgetKind[]).map(k => (
                  <button key={k} type="button" onClick={() => setBForm({ ...bForm, kind: k, category: "", ref_id: "" })}
                    className={`rounded-full px-3 py-2 text-xs capitalize ${bForm.kind === k ? "bg-primary text-primary-foreground" : "bg-accent"}`}>
                    {k === "category" ? "Despesa" : k === "card" ? "Cartão" : k === "reserve" ? "Reserva" : "Investimento"}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">O item será agrupado automaticamente na seção correspondente.</p>
            </div>
            {bForm.kind === "category" && (() => {
              const opts = cats.filter(c => !c.archived && c.type === "despesa");
              return (
                <div>
                  <Label>Categoria de despesa</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={bForm.category} onChange={e => setBForm({ ...bForm, category: e.target.value })}>
                    <option value="">Selecione…</option>
                    {opts.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  {!opts.length && (
                    <button type="button" onClick={() => setCatMgrOpen(true)} className="mt-1 text-xs text-primary underline">Cadastrar categorias de despesa</button>
                  )}
                </div>
              );
            })()}
            {bForm.kind === "card" && (
              <div>
                <Label>Cartão</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={bForm.ref_id} onChange={e => setBForm({ ...bForm, ref_id: e.target.value })}>
                  <option value="">—</option>
                  {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {bForm.kind === "reserve" && (
              <div>
                <Label>Reserva</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={bForm.ref_id} onChange={e => setBForm({ ...bForm, ref_id: e.target.value })}>
                  <option value="">—</option>
                  {jars.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
            )}
            {bForm.kind === "investment" && (
              <div>
                <Label>Investimento</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={bForm.ref_id} onChange={e => setBForm({ ...bForm, ref_id: e.target.value })}>
                  <option value="">—</option>
                  {invs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            )}
            <div><Label>Valor planejado (R$)</Label><Input type="number" step="0.01" value={bForm.amount} onChange={e => setBForm({ ...bForm, amount: +e.target.value })} /></div>
            <Button onClick={saveNewBudget} className="w-full rounded-full">Adicionar ao plano</Button>
          </div>
        </DialogContent>
      </Dialog>

      <CategoriesManager open={catMgrOpen} onOpenChange={setCatMgrOpen} cats={cats} />
    </div>
  );
}


// ============================================================
// PATRIMONY AUDIT MODAL
function PatrimonyAudit({ accounts, fins, invs, jars, accountsTotal, totalInvs, totalJars, futureCardExpense, patrimony, today }:
  { accounts: Account[]; fins: Fin[]; invs: Inv[]; jars: Jar[]; accountsTotal: number; totalInvs: number; totalJars: number; futureCardExpense: number; patrimony: number; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Como o patrimônio foi calculado?
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Como foi calculado seu patrimônio</DialogTitle></DialogHeader>
          <div className="space-y-5 text-sm">
            <p className="text-muted-foreground">Seu patrimônio soma o saldo real de todas as contas com o valor investido. Reservas não somam — elas apenas separam parte do saldo das contas.</p>

            <section className="cozy-card p-4">
              <div className="mb-2 flex items-center justify-between font-display text-base"><span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Saldo em contas</span><span>{fmtBRL(accountsTotal)}</span></div>
              {accounts.length ? (
                <ul className="space-y-1">
                  {accounts.map(ac => {
                    const bal = balanceFor(ac, fins, today);
                    return (<li key={ac.id} className="flex justify-between text-muted-foreground"><span>{ac.name}<span className="ml-2 text-xs">(inicial {fmtBRL(Number(ac.initial_balance))})</span></span><span className="font-medium text-foreground">{fmtBRL(bal)}</span></li>);
                  })}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Sem contas cadastradas — o saldo aqui é derivado das receitas menos despesas pagas.</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Cada saldo = saldo inicial + receitas recebidas − despesas pagas + transferências recebidas − transferências enviadas.</p>
            </section>

            <section className="cozy-card p-4">
              <div className="mb-2 flex items-center justify-between font-display text-base"><span className="flex items-center gap-2"><LineChart className="h-4 w-4 text-primary" /> Investimentos</span><span>{fmtBRL(totalInvs)}</span></div>
              {invs.length ? (
                <ul className="space-y-1">
                  {invs.map(i => (<li key={i.id} className="flex justify-between text-muted-foreground"><span>{i.name}</span><span className="font-medium text-foreground">{fmtBRL(Number(i.current_amount))}</span></li>))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Sem investimentos cadastrados.</p>
              )}
            </section>

            <section className="cozy-card p-4">
              <div className="mb-2 flex items-center justify-between font-display text-base"><span className="flex items-center gap-2"><PiggyBank className="h-4 w-4 text-primary" /> Reservas</span><span>{fmtBRL(totalJars)}</span></div>
              {jars.length ? (
                <ul className="space-y-1">
                  {jars.map(j => (<li key={j.id} className="flex justify-between text-muted-foreground"><span>{j.name}</span><span className="font-medium text-foreground">{fmtBRL(Number(j.current_amount))}</span></li>))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Sem reservas cadastradas.</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Aportes e resgates só mudam o dinheiro de lugar: saem da conta e entram na reserva (ou o contrário), sem alterar o patrimônio total.</p>
            </section>

            <section className="cozy-card p-4">
              <div className="flex items-center justify-between font-display text-base"><span>Total</span><span>{fmtBRL(patrimony)}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">{fmtBRL(accountsTotal)} (contas) + {fmtBRL(totalJars)} (reservas) + {fmtBRL(totalInvs)} (investimentos) = {fmtBRL(patrimony)}</p>
              {futureCardExpense > 0 && (
                <p className="mt-2 text-xs text-amber-700">Atenção: existem {fmtBRL(futureCardExpense)} em despesas de cartão ainda não pagas. Elas reduzirão o saldo quando a fatura for quitada, mas ainda não foram descontadas do patrimônio.</p>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// CATEGORIES MANAGER
function CategoriesManager({ open, onOpenChange, cats }: { open: boolean; onOpenChange: (v: boolean) => void; cats: Cat[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CatType>("despesa");
  const TYPES: CatType[] = ["receita", "despesa", "reserva", "investimento"];

  const add = async () => {
    if (!user || !newName.trim()) return;
    const { error } = await (supabase as any).from("finance_categories").insert({
      user_id: user.id, name: newName.trim(), type: newType,
    });
    if (error) return toast.error(error.message.includes("duplicate") ? "Categoria já existe." : error.message);
    setNewName("");
    qc.invalidateQueries({ queryKey: ["finance_categories"] });
  };

  const remove = async (id: string) => {
    await (supabase as any).from("finance_categories").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["finance_categories"] });
  };

  const toggleArchived = async (c: Cat) => {
    await (supabase as any).from("finance_categories").update({ archived: !c.archived }).eq("id", c.id);
    qc.invalidateQueries({ queryKey: ["finance_categories"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Categorias financeiras</DialogTitle></DialogHeader>
        <p className="mb-3 text-sm text-muted-foreground">Estas categorias são usadas em receitas, despesas, orçamento e relatórios — uma única fonte de cadastro.</p>

        <div className="mb-4 rounded-xl border bg-accent/30 p-3">
          <Label>Nova categoria</Label>
          <div className="mt-1 grid grid-cols-[1fr_auto_auto] gap-2">
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Mercado" onKeyDown={(e) => e.key === "Enter" && add()} />
            <select value={newType} onChange={e => setNewType(e.target.value as CatType)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              {TYPES.map(t => <option key={t} value={t}>{CAT_TYPE_LABEL[t]}</option>)}
            </select>
            <Button onClick={add} className="rounded-full">Adicionar</Button>
          </div>
        </div>

        <div className="space-y-4">
          {TYPES.map(t => {
            const list = cats.filter(c => c.type === t);
            return (
              <div key={t}>
                <div className="mb-2 flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${CAT_TYPE_TINT[t]}`}>{CAT_TYPE_LABEL[t]}</span>
                  <span className="text-xs text-muted-foreground">{list.length} categoria{list.length !== 1 ? "s" : ""}</span>
                </div>
                {!list.length ? <p className="text-xs text-muted-foreground">Nenhuma categoria nesse grupo.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {list.map(c => (
                      <div key={c.id} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${c.archived ? "opacity-50" : ""}`}>
                        <span>{c.name}</span>
                        <button onClick={() => toggleArchived(c)} className="text-xs text-muted-foreground hover:text-foreground" title={c.archived ? "Reativar" : "Arquivar"}>
                          {c.archived ? "↺" : "—"}
                        </button>
                        <button onClick={() => remove(c.id)} className="text-xs text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
