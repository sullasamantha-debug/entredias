// PDF bank statement reader (browser-side) tolerant to Brazilian bank layouts.

export type PdfTx = {
  date: string;              // YYYY-MM-DD
  description: string;
  amount: number;            // positive value
  type: "CREDIT" | "DEBIT";
  balanceAfter: number | null;
  doc: string | null;
};

export type PdfStatement = {
  transactions: PdfTx[];
  periodStart: string | null;
  periodEnd: string | null;
  bank: string | null;
  account: string | null;
  needsOcr: boolean;
  rawLines: string[];
};

const BANKS: { re: RegExp; name: string }[] = [
  { re: /nubank|nu pagamentos/i, name: "Nubank" },
  { re: /banco\s+inter|inter\s*&|intermedium/i, name: "Banco Inter" },
  { re: /ita[úu]|itau unibanco/i, name: "Itaú" },
  { re: /bradesco/i, name: "Bradesco" },
  { re: /santander/i, name: "Santander" },
  { re: /banco\s+do\s+brasil|bb\b/i, name: "Banco do Brasil" },
  { re: /caixa econ[oô]mica|caixa\b/i, name: "Caixa" },
  { re: /c6\s*bank/i, name: "C6 Bank" },
  { re: /banco\s+original/i, name: "Original" },
  { re: /picpay/i, name: "PicPay" },
  { re: /mercado\s*pago/i, name: "Mercado Pago" },
  { re: /sicredi/i, name: "Sicredi" },
  { re: /sicoob/i, name: "Sicoob" },
  { re: /safra/i, name: "Safra" },
  { re: /btg\s*pactual/i, name: "BTG Pactual" },
  { re: /will\s*bank/i, name: "Will Bank" },
  { re: /neon/i, name: "Neon" },
];

/** Extract text lines from a PDF file using pdf.js (client only). */
export async function extractPdfLines(file: File): Promise<{ lines: string[]; hasText: boolean; pages: number }> {
  const pdfjs: any = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as any).default;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items as any[]) {
      const str = String(item.str ?? "");
      if (!str.trim()) continue;
      const y = Math.round((item.transform?.[5] ?? 0) / 3) * 3;
      const x = item.transform?.[4] ?? 0;
      const arr = rows.get(y) ?? [];
      arr.push({ x, s: str });
      rows.set(y, arr);
    }
    const ys = Array.from(rows.keys()).sort((a, b) => b - a);
    for (const y of ys) {
      const line = (rows.get(y) ?? []).sort((a, b) => a.x - b.x).map(i => i.s).join(" ")
        .replace(/\s{2,}/g, " ").trim();
      if (line) lines.push(line);
    }
  }
  const hasText = lines.join("").replace(/\s/g, "").length > 30;
  return { lines, hasText, pages: doc.numPages };
}

const AMOUNT_RE = /(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}-?|-?\d+,\d{2}-?)\s*([CD])?\b/g;

function parseAmount(raw: string): { value: number; negative: boolean } {
  let s = raw.trim();
  let negative = false;
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  if (s.endsWith("-")) { negative = true; s = s.slice(0, -1); }
  const value = Number(s.replace(/\./g, "").replace(",", "."));
  return { value: Number.isFinite(value) ? value : 0, negative };
}

function toISO(d: number, m: number, y: number | null, fallbackYear: number): string {
  let year = y ?? fallbackYear;
  if (year < 100) year += 2000;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const MONTHS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const DEBIT_HINTS = /\b(d[eé]bito|pagamento|pago|compra|saque|tarifa|taxa|iof|juros|boleto|envio|enviad[oa]|transfer[eê]ncia enviada|pix enviado|debit)\b/i;
const CREDIT_HINTS = /(\b(cr[eé]dito|recebid[oa]|recebimento|dep[oó]sito|entrada|estorno|reembolso|rendimentos?|rend\.?\b|remunera[çc][ãa]o|juros|dividendos?|cashback|corre[çc][ãa]o monet|salario|sal[aá]rio|pix recebido|transfer[eê]ncia recebida)\b)/i;

/** Linhas de saldo (não são movimentação) — informam apenas o saldo de referência. */
export const BALANCE_RE = /^saldo\b(\s*(anterior|inicial|final|atual|do\s+dia|da\s+conta|em\s+conta|dispon[íi]vel|total|bloqueado|\(r\$\)|r\$|:|em\s+\d))?/i;
/** Linhas de totalizador/resumo — descartadas sem alterar o saldo de referência. */
export const NON_TX_RE = /^(total(\s+(de|dos|das|geral))?\b|subtotal\b|resumo\b|somat[óo]rio\b|entradas\s+e\s+sa[íi]das\b)/i;

/** true quando a linha/descrição é saldo ou totalizador, não um lançamento. */
export const isNonTransactionText = (text: string) =>
  BALANCE_RE.test((text || "").trim()) || NON_TX_RE.test((text || "").trim());

/** Parse statement lines into transactions. */
export function parsePdfStatement(lines: string[]): PdfStatement {
  const joined = lines.join("\n");
  const bank = BANKS.find(b => b.re.test(joined))?.name ?? null;

  const acctMatch =
    joined.match(/conta(?:\s+corrente)?\s*(?:n[ºo°]?\.?\s*)?[:\s]\s*([\d.\-/]{4,})/i) ??
    joined.match(/ag[êe]ncia\s*[:\s]\s*([\d.\-/]+)\s*(?:\/|\s)\s*conta\s*[:\s]?\s*([\d.\-/]{4,})/i);
  const account = acctMatch ? acctMatch.slice(1).filter(Boolean).join(" / ") : null;

  // period
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  const per = joined.match(/(\d{2}\/\d{2}\/\d{2,4})\s*(?:a|até|-|–)\s*(\d{2}\/\d{2}\/\d{2,4})/i);
  const isoOf = (br: string) => {
    const [d, m, y] = br.split("/").map(Number);
    return toISO(d, m, y, new Date().getFullYear());
  };
  if (per) { periodStart = isoOf(per[1]); periodEnd = isoOf(per[2]); }

  // fallback year: from period, an explicit month-name header, or current year
  let fallbackYear = new Date().getFullYear();
  const yMatch = joined.match(/\b(20\d{2})\b/);
  if (periodStart) fallbackYear = Number(periodStart.slice(0, 4));
  else if (yMatch) fallbackYear = Number(yMatch[1]);

  const txs: PdfTx[] = [];
  let prevBalance: number | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\u00a0/g, " ").trim();
    if (!line) continue;
    const lastAmountOf = (text: string) => {
      const amts = [...text.matchAll(AMOUNT_RE)];
      if (!amts.length) return null;
      const p = parseAmount(amts[amts.length - 1][1]);
      return p.negative ? -p.value : p.value;
    };
    if (BALANCE_RE.test(line)) {
      const bal = lastAmountOf(line);
      if (bal !== null) prevBalance = bal;
      continue;
    }
    if (NON_TX_RE.test(line)) continue;


    // date at start: dd/mm/yyyy, dd/mm, or "12 fev"
    let d: number | null = null, m: number | null = null, y: number | null = null;
    let rest = line;
    let mm = line.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(.*)$/);
    if (mm) { d = +mm[1]; m = +mm[2]; y = mm[3] ? +mm[3] : null; rest = mm[4]; }
    else {
      mm = line.match(/^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\w*\.?\s+(.*)$/i);
      if (mm) { d = +mm[1]; m = MONTHS[mm[2].toLowerCase().slice(0, 3)]; rest = mm[3]; }
    }

    // "01/09/2026 SALDO DO DIA 1.234,56" → saldo, não lançamento
    if (d !== null && m !== null) {
      if (BALANCE_RE.test(rest)) {
        const bal = lastAmountOf(rest);
        if (bal !== null) prevBalance = bal;
        continue;
      }
      if (NON_TX_RE.test(rest)) continue;
    }

    const amounts = [...rest.matchAll(AMOUNT_RE)];


    if (d === null || m === null || !amounts.length) {
      // continuation line: append to previous description when it carries no amounts
      if (txs.length && d === null && !amounts.length && /[a-zA-ZÀ-ú]/.test(line) && line.length <= 80
        && !/^(p[áa]gina|extrato|data|hist[oó]rico|lan[çc]amento|saldo|documento|valor|total)/i.test(line)) {
        const last = txs[txs.length - 1];
        if (last.description.length < 90) last.description = `${last.description} ${line}`.replace(/\s{2,}/g, " ").trim();
      }
      continue;
    }
    if (!m || m > 12 || d > 31) continue;

    // last amount may be the running balance
    let valueTok = amounts[0];
    let balanceAfter: number | null = null;
    if (amounts.length >= 2) {
      const balParsed = parseAmount(amounts[amounts.length - 1][1]);
      balanceAfter = balParsed.negative ? -balParsed.value : balParsed.value;
      valueTok = amounts[amounts.length - 2];
    }

    const parsed = parseAmount(valueTok[1]);
    if (!parsed.value) continue;
    const cd = (valueTok[2] ?? "").toUpperCase();

    // description = text before the first amount
    const firstIdx = valueTok.index ?? 0;
    let description = rest.slice(0, amounts[0].index ?? firstIdx).replace(/\s{2,}/g, " ").trim();
    if (!description) description = rest.replace(AMOUNT_RE, "").replace(/\s{2,}/g, " ").trim();

    // document number
    const docMatch = description.match(/\b(\d{6,})\b\s*$/);
    let doc: string | null = docMatch ? docMatch[1] : null;
    if (doc) description = description.slice(0, docMatch!.index).trim();
    description = description.replace(/^[-–•|]+\s*/, "").trim();

    // type resolution
    let type: "CREDIT" | "DEBIT";
    if (cd === "C") type = "CREDIT";
    else if (cd === "D") type = "DEBIT";
    else if (parsed.negative) type = "DEBIT";
    else if (balanceAfter !== null && prevBalance !== null && Math.abs(Math.abs(balanceAfter - prevBalance) - parsed.value) < 0.02) {
      type = balanceAfter >= prevBalance ? "CREDIT" : "DEBIT";
    } else if (CREDIT_HINTS.test(description)) type = "CREDIT";
    else if (DEBIT_HINTS.test(description)) type = "DEBIT";
    else type = "DEBIT";

    if (balanceAfter !== null) prevBalance = balanceAfter;

    txs.push({
      date: toISO(d, m, y, fallbackYear),
      description: description || "Movimentação",
      amount: parsed.value,
      type,
      balanceAfter,
      doc,
    });
  }

  const dates = txs.map(t => t.date).sort();
  return {
    transactions: txs,
    periodStart: periodStart ?? (dates[0] ?? null),
    periodEnd: periodEnd ?? (dates[dates.length - 1] ?? null),
    bank,
    account,
    needsOcr: false,
    rawLines: lines,
  };
}
