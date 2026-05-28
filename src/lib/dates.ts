import { format } from "date-fns";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(value: string) {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateOnly(value: string) {
  const p = parts(value);
  if (!p) return new Date(value);
  return new Date(p.year, p.month - 1, p.day);
}

export function formatDateBR(value: string | null | undefined, shortYear = false) {
  if (!value) return "";
  const p = parts(value);
  if (!p) return value;
  const year = String(p.year);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${shortYear ? year.slice(-2) : year}`;
}

export function formatDateOnly(value: string, pattern: string, options?: Parameters<typeof format>[2]) {
  return format(parseDateOnly(value), pattern, options);
}