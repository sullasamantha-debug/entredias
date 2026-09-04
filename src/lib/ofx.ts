// OFX (SGML/XML) parser tolerant to Brazilian bank variations.

export type OFXTx = {
  fitid: string | null;
  date: string;            // YYYY-MM-DD
  amount: number;          // signed (negative = debit)
  type: "CREDIT" | "DEBIT";
  memo: string;            // description/history
  checknum: string | null; // document number
};

export type OFXParsed = {
  transactions: OFXTx[];
  periodStart: string | null;
  periodEnd: string | null;
  bankId: string | null;
  acctId: string | null;
};

function normalize(raw: string): string {
  // Strip OFX SGML header block (before first "<")
  const idx = raw.indexOf("<");
  const body = idx >= 0 ? raw.slice(idx) : raw;
  // Auto-close SGML tags: <TAG>value  → <TAG>value</TAG> when next line starts with < or new tag
  // Simple approach: for tags without a closing pair, insert closing before next tag.
  return body.replace(/<([A-Z0-9.]+)>([^<\r\n]+?)(?=\s*<)/g, (_m, tag, val) => `<${tag}>${val.trim()}</${tag}>`);
}

function parseDate(raw: string): string {
  // Formats: YYYYMMDDHHMMSS[.xxx][TZ], YYYYMMDD
  const s = raw.replace(/\[.*$/, "").trim();
  const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8);
  if (y && m && d && /^\d{4}$/.test(y)) return `${y}-${m}-${d}`;
  return s;
}

function findAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function findFirst(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(xml);
  return m ? m[1].trim() : null;
}

export function parseOFX(raw: string): OFXParsed {
  const xml = normalize(raw);
  const bankId = findFirst(xml, "BANKID");
  const acctId = findFirst(xml, "ACCTID");
  const dtStart = findFirst(xml, "DTSTART");
  const dtEnd = findFirst(xml, "DTEND");

  const txBlocks = findAll(xml, "STMTTRN");
  const transactions: OFXTx[] = txBlocks.map((b) => {
    const dt = findFirst(b, "DTPOSTED") ?? findFirst(b, "DTUSER") ?? "";
    const amtRaw = (findFirst(b, "TRNAMT") ?? "0").replace(",", ".");
    const amount = Number(amtRaw) || 0;
    const trntype = (findFirst(b, "TRNTYPE") ?? "").toUpperCase();
    const memo = (findFirst(b, "MEMO") ?? findFirst(b, "NAME") ?? "").trim();
    const fitid = findFirst(b, "FITID");
    const checknum = findFirst(b, "CHECKNUM");
    const type: "CREDIT" | "DEBIT" =
      trntype === "CREDIT" || trntype === "DEP" || trntype === "INT" || amount > 0 ? "CREDIT" : "DEBIT";
    return { fitid, date: parseDate(dt), amount, type, memo, checknum };
  }).filter(t => t.date && !Number.isNaN(t.amount));

  return {
    transactions,
    periodStart: dtStart ? parseDate(dtStart) : null,
    periodEnd: dtEnd ? parseDate(dtEnd) : null,
    bankId, acctId,
  };
}

// -------- Category suggestion --------
export type SuggestionRule = { pattern: string; category: string; cat_type: string };

const BUILTIN_RULES: { pattern: RegExp; category: string; cat_type: "despesa" | "receita" }[] = [
  { pattern: /ifood|rappi|ubereats|zedelivery|ze delivery/i, category: "Restaurante", cat_type: "despesa" },
  { pattern: /uber|99app|99 taxi|cabify|taxi/i, category: "Transporte", cat_type: "despesa" },
  { pattern: /petlove|petz|cobasi|vet\b|pet shop/i, category: "Pets", cat_type: "despesa" },
  { pattern: /drogasil|drogaria|farmacia|panvel|raia|drogaraia/i, category: "Saúde", cat_type: "despesa" },
  { pattern: /amazon|mercadolivre|mercado livre|shopee|magalu|aliexpress|shein/i, category: "Compras", cat_type: "despesa" },
  { pattern: /netflix|spotify|disney|hbo|prime video|youtube premium|deezer|globoplay/i, category: "Assinaturas", cat_type: "despesa" },
  { pattern: /uber\s*gasol|posto|shell|ipiranga|petrobras|combust/i, category: "Transporte", cat_type: "despesa" },
  { pattern: /pao de acucar|carrefour|extra|assai|atacad[aã]o|mercado|supermerc|hortifruti|sams? club/i, category: "Mercado", cat_type: "despesa" },
  { pattern: /academia|smartfit|bio ?ritmo|crossfit/i, category: "Saúde", cat_type: "despesa" },
  { pattern: /escola|colegio|faculd|universid|udemy|alura|coursera/i, category: "Educação", cat_type: "despesa" },
  { pattern: /aluguel|condom[ií]nio|iptu|luz|energia|enel|cemig|copel|sabesp|comgas|vivo|claro|tim|oi\b|net\b|internet/i, category: "Contas", cat_type: "despesa" },
  { pattern: /pagamento fatura|pgto fatura|pag\.?\s*fatura|pagto cart[aã]o|pagamento cart[aã]o/i, category: "Pagamento de Fatura", cat_type: "despesa" },
  { pattern: /sal[aá]rio|folha|proventos|remunera[cç][aã]o/i, category: "Salário", cat_type: "receita" },
  { pattern: /rendimentos?|\brend\.|\brend\b|remunera[çc][ãa]o|juros|dividendos?|cashback|corre[çc][ãa]o\s+monet|yield/i, category: "Rendimentos", cat_type: "receita" },
  { pattern: /pix\s+receb|ted\s+receb|doc\s+receb|transf\s+receb/i, category: "Transferência", cat_type: "receita" },
  { pattern: /reembolso|estorno/i, category: "Reembolso", cat_type: "receita" },
];

export function suggestCategory(
  memo: string,
  type: "CREDIT" | "DEBIT",
  learned: SuggestionRule[] = []
): { category: string | null; cat_type: "receita" | "despesa"; isCardPayment: boolean } {
  const m = (memo || "").toLowerCase();
  const isCardPayment = /pagamento\s+(de\s+)?fatura|pgto\s+fatura|pagto\s+cart[aã]o|pagamento\s+cart[aã]o/i.test(memo);
  // Learned rules first (user's history wins)
  for (const r of learned) {
    if (!r.pattern) continue;
    if (m.includes(r.pattern.toLowerCase())) {
      return { category: r.category, cat_type: (r.cat_type as any) === "receita" ? "receita" : "despesa", isCardPayment };
    }
  }
  for (const r of BUILTIN_RULES) {
    if (r.pattern.test(memo)) {
      return { category: r.category, cat_type: r.cat_type, isCardPayment };
    }
  }
  return { category: null, cat_type: type === "CREDIT" ? "receita" : "despesa", isCardPayment };
}

// Extract a stable pattern from a memo (first 2-3 meaningful tokens uppercased)
export function memoPattern(memo: string): string {
  const tokens = (memo || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= 3 && !/^\d+$/.test(t));
  return tokens.slice(0, 2).join(" ");
}
