import { parseDateOnly } from "./dates";

export function fmtBRL(n: number) {
  return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function monthKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

export function labelMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Fatura que recebe a compra: se data ≤ dia de fechamento → mês atual, senão → mês seguinte. */
export function invoiceMonthFor(dateStr: string, closingDay: number) {
  const d = parseDateOnly(dateStr);
  const base = monthKey(d);
  return d.getDate() <= closingDay ? base : addMonth(base, 1);
}

/** Data de vencimento da fatura X (YYYY-MM). */
export function dueDateOf(invoice: string, dueDay: number) {
  const [y, m] = invoice.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const day = Math.min(dueDay, last);
  return `${invoice}-${String(day).padStart(2, "0")}`;
}

export function daysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseDateOnly(dateStr);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// ---------------------------------------------------------------
// Saldo real por conta ao final de cada dia
export type BalanceAccount = { id: string; initial_balance: number; initial_balance_date: string | null };
export type BalanceFin = {
  kind: string; amount: number; date: string; paid: boolean;
  account_id: string | null; to_account_id: string | null;
};
export type DayBalance = { per: Record<string, number>; total: number };

/**
 * Saldo real de cada conta ao final de cada dia com movimentação.
 * Usa SEMPRE a lista completa de lançamentos (sem filtros de tela), para que o
 * saldo do dia represente o saldo verdadeiro da conta.
 */
export function dailyBalances(accounts: BalanceAccount[], fins: BalanceFin[]): Map<string, DayBalance> {
  const per: Record<string, number> = {};
  for (const a of accounts) per[a.id] = Number(a.initial_balance) || 0;
  const since = new Map(accounts.map(a => [a.id, a.initial_balance_date || "0000-01-01"]));

  const byDate = new Map<string, BalanceFin[]>();
  for (const f of fins) {
    const arr = byDate.get(f.date) ?? [];
    arr.push(f);
    byDate.set(f.date, arr);
  }
  const dates = Array.from(byDate.keys()).sort();
  const out = new Map<string, DayBalance>();

  for (const date of dates) {
    for (const f of byDate.get(date)!) {
      const amt = Number(f.amount) || 0;
      const outId = f.account_id;
      const inId = f.to_account_id;
      if (f.kind === "income" && outId && per[outId] !== undefined && date >= (since.get(outId) ?? "")) per[outId] += amt;
      else if (f.kind === "expense" && f.paid && outId && per[outId] !== undefined && date >= (since.get(outId) ?? "")) per[outId] -= amt;
      else if (f.kind === "transfer") {
        if (outId && per[outId] !== undefined && date >= (since.get(outId) ?? "")) per[outId] -= amt;
        if (inId && per[inId] !== undefined && date >= (since.get(inId) ?? "")) per[inId] += amt;
      }
    }
    const snapshot = { ...per };
    out.set(date, { per: snapshot, total: Object.values(snapshot).reduce((a, b) => a + b, 0) });
  }
  return out;
}

