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
