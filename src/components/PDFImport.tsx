import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, FileText, X, FileType2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, invoiceMonthFor, labelMonth, monthKey } from "@/lib/finance";
import { formatDateBR } from "@/lib/dates";
import { suggestCategory, memoPattern, type SuggestionRule } from "@/lib/ofx";
import { extractPdfLines, parsePdfStatement, type PdfTx } from "@/lib/pdf-statement";
import { OFXImportButton } from "@/components/OFXImport";
import {
  detectApplication, resolveTargets, applyPatrimonyEffects, patLabelFor,
  isJarKind, isOutflowKind, NEW_TARGET, PAT_KINDS, type PatKind,
} from "@/lib/patrimony";

type Cat = { id: string; name: string; type: "receita" | "despesa" | "reserva" | "investimento"; archived: boolean };
type Account = { id: string; name: string };
type CardT = { id: string; name: string; closing_day: number; due_day: number };
type JarT = { id: string; name: string };
type InvT = { id: string; name: string };

type Kind = "income" | "expense" | "transfer" | "jar_deposit" | "jar_withdraw" | "invest_in" | "invest_out" | "card_payment";

type Row = {
  date: string;
  description: string;
  memo: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  balanceAfter: number | null;
  doc: string | null;
  category: string;
  kind: Kind;
  toAccountId: string;
  cardId: string;
  invoiceMonth: string;
  targetId: string;
  newName: string;
  appHint: boolean;
  ignore: boolean;
  duplicate: boolean;
  duplicateId: string | null;
  duplicateAction: "skip" | "import" | "update";
};

const TRANSFER_KINDS: Kind[] = ["transfer", "jar_deposit", "jar_withdraw", "invest_in", "invest_out"];
const CARD_PAY_RE = /pagamento\s+(de\s+)?fatura|pgto\.?\s*fatura|pagto\s*cart[aã]o|pagamento\s+cart[aã]o|fatura\s+cart[aã]o/i;


export function PDFImportButton({ account, accounts, cats, cards = [], asItem = false }:
  { account: Account; accounts: Account[]; cats: Cat[]; cards?: CardT[]; asItem?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [meta, setMeta] = useState<{ bank: string | null; account: string | null; start: string | null; end: string | null }>({ bank: null, account: null, start: null, end: null });
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);

  const { data: rules } = useQuery({
    enabled: !!user,
    queryKey: ["ofx_category_rules", user?.id],
    queryFn: async () => (((await (supabase as any).from("ofx_category_rules").select("pattern, category, cat_type")).data) ?? []) as SuggestionRule[],
  });
  const { data: jars } = useQuery({
    enabled: !!user,
    queryKey: ["jars", user?.id],
    queryFn: async () => ((await supabase.from("savings_jars").select("id, name").order("name")).data ?? []) as JarT[],
  });
  const { data: invs } = useQuery({
    enabled: !!user,
    queryKey: ["investments", user?.id],
    queryFn: async () => ((await supabase.from("investments").select("id, name").order("name")).data ?? []) as InvT[],
  });


  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setFileName(file.name);
    setReading(true);
    try {
      const { lines, hasText } = await extractPdfLines(file);
      if (!hasText) {
        toast.error("Este PDF parece ser digitalizado (imagem) e não possui texto selecionável. Passe o arquivo por um reconhecimento de texto (OCR) e tente novamente, ou importe o OFX.");
        return;
      }
      const parsed = parsePdfStatement(lines);
      if (!parsed.transactions.length) {
        toast.error("Não conseguimos identificar movimentações neste PDF. Confira se é o extrato completo ou use o arquivo OFX.");
        return;
      }

      const dates = Array.from(new Set(parsed.transactions.map(t => t.date)));
      const { data: existing } = await supabase.from("finances")
        .select("id, date, amount, description, notes")
        .eq("account_id", account.id).in("date", dates);
      const byDateAmt = new Map<string, { id: string; description: string | null; notes: string | null }>();
      (existing ?? []).forEach((r: any) => {
        byDateAmt.set(`${r.date}|${Number(r.amount).toFixed(2)}`, { id: r.id, description: r.description, notes: r.notes });
      });

      const learned = rules ?? [];
      const newRows: Row[] = parsed.transactions.map((t: PdfTx) => {
        const s = suggestCategory(t.description, t.type, learned);
        const isCardPay = CARD_PAY_RE.test(t.description);
        const hit = byDateAmt.get(`${t.date}|${t.amount.toFixed(2)}`);
        const app = detectApplication(t.description, t.type);
        const baseKind: Kind = isCardPay && cards.length ? "card_payment" : t.type === "CREDIT" ? "income" : "expense";
        const kind: Kind = !isCardPay && app.suggested ? app.suggested : baseKind;
        const isPat = PAT_KINDS.includes(kind as PatKind);
        return {
          date: t.date,
          description: t.description,
          memo: t.description,
          amount: t.amount,
          type: t.type,
          balanceAfter: t.balanceAfter,
          doc: t.doc,
          category: kind === "card_payment" ? "pagamento de fatura" : isPat ? "transferência patrimonial" : (s.category ?? ""),
          kind,
          toAccountId: "",
          cardId: kind === "card_payment" ? (cards[0]?.id ?? "") : "",
          invoiceMonth: monthKey(new Date(`${t.date}T12:00:00`)),
          targetId: "",
          newName: "",
          appHint: app.isApplication && !isCardPay,
          ignore: false,
          duplicate: !!hit,
          duplicateId: hit?.id ?? null,
          duplicateAction: "skip",
        };
      });
      setRows(newRows);
      setMeta({ bank: parsed.bank, account: parsed.account, start: parsed.periodStart, end: parsed.periodEnd });
      setOpen(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível ler o PDF.");
    } finally {
      setReading(false);
    }
  };

  const updateRow = (i: number, patch: Partial<Row>) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const setKind = (i: number, kind: Kind) => {
    const r = rows[i];
    updateRow(i, {
      kind,
      cardId: kind === "card_payment" ? (r.cardId || cards[0]?.id || "") : "",
      targetId: "",
      newName: "",
      category: TRANSFER_KINDS.includes(kind) ? "transferência patrimonial" : kind === "card_payment" ? "pagamento de fatura" : "",
    });
  };


  const selected = rows.filter(r => !r.ignore && !(r.duplicate && r.duplicateAction === "skip"));
  const dupCount = rows.filter(r => r.duplicate).length;
  const ignoredCount = rows.filter(r => r.ignore).length;
  const catOptions = useMemo(() => cats.filter(c => !c.archived), [cats]);

  const runImport = async () => {
    if (!user) return;

    const patRows = selected.filter(r => PAT_KINDS.includes(r.kind as PatKind));
    const missingTarget = patRows.some(r => !r.targetId || (r.targetId === NEW_TARGET && !r.newName.trim()));
    if (missingTarget) {
      toast.error("Escolha a reserva ou o investimento de destino nas linhas de aporte/resgate.");
      return;
    }

    setBusy(true);
    try {
      const resolved = await resolveTargets(
        user.id,
        selected.map(r => PAT_KINDS.includes(r.kind as PatKind)
          ? { kind: r.kind as PatKind, targetId: r.targetId, newName: r.newName }
          : null),
        { jars: jars ?? [], invs: invs ?? [] },
      );

      const { data: imp, error: iErr } = await (supabase as any).from("ofx_imports").insert({
        user_id: user.id, account_id: account.id, file_name: fileName, source_type: "pdf",
        period_start: meta.start, period_end: meta.end,
        found_count: rows.length, imported_count: 0, skipped_count: ignoredCount, duplicate_count: dupCount,
      }).select("id").single();
      if (iErr || !imp) { toast.error(iErr?.message ?? "Falha ao registrar importação."); return; }

      const toInsert: any[] = [];
      const toUpdate: { id: string; patch: any }[] = [];
      const invoicesToSettle: { cardId: string; month: string }[] = [];
      const learnPatterns = new Map<string, { category: string; cat_type: string }>();
      const effects: EffectItem[] = [];

      for (let idx = 0; idx < selected.length; idx++) {
        const r = selected[idx];
        const res = resolved[idx];
        const isTransferKind = TRANSFER_KINDS.includes(r.kind);
        const isCardPayment = r.kind === "card_payment";
        const kindStored = r.kind === "income" ? "income" : r.kind === "expense" ? "expense" : "transfer";
        const category = isTransferKind ? "transferência patrimonial" : isCardPayment ? "pagamento de fatura" : (r.category || null);
        const notes = [r.doc ? `Doc: ${r.doc}` : null, "Importado de PDF"].filter(Boolean).join(" · ");
        const row = res
          ? patFinanceRow(user.id, {
              kind: res.kind, amount: r.amount, date: r.date, accountId: account.id,
              targetName: res.targetName, notes: `${notes} · ${patFlowLabel(res.kind, res.targetName, account.name)}`,
              importId: imp.id,
            })
          : {
              user_id: user.id,
              kind: kindStored,
              amount: r.amount,
              category,
              description: r.description || null,
              date: r.date,
              payment_method: kindStored === "transfer" ? "transferência" : "débito",
              installments: 1,
              notes,
              paid: true,
              account_id: account.id,
              to_account_id: r.kind === "transfer" ? (r.toAccountId || null) : null,
              ofx_import_id: imp.id,
            };
        if (r.duplicate && r.duplicateAction === "update" && r.duplicateId) {
          toUpdate.push({ id: r.duplicateId, patch: row });
          if (res) effects.push({ res, amount: r.amount, date: r.date, accountId: account.id, accountName: account.name });
        } else if (!r.duplicate || r.duplicateAction === "import") {
          toInsert.push(row);
          if (res) effects.push({ res, amount: r.amount, date: r.date, accountId: account.id, accountName: account.name });
          if (!isTransferKind && !isCardPayment && r.category) {
            const p = memoPattern(r.memo);
            if (p && !learnPatterns.has(p)) learnPatterns.set(p, { category: r.category, cat_type: r.type === "CREDIT" ? "receita" : "despesa" });
          }
        }
        if (isCardPayment && r.cardId) invoicesToSettle.push({ cardId: r.cardId, month: r.invoiceMonth });
      }

      if (toInsert.length) {
        const { error } = await supabase.from("finances").insert(toInsert);
        if (error) { toast.error(error.message); return; }
      }
      for (const u of toUpdate) await supabase.from("finances").update(u.patch).eq("id", u.id);

      // Aportes/resgates: atualizam reservas e investimentos e gravam o histórico
      await applyPatrimonyEffects(user.id, effects);

      // Settle the corresponding credit-card invoices (no new expense is created)
      for (const inv of invoicesToSettle) {
        await supabase.from("finances").update({ paid: true })
          .eq("card_id", inv.cardId).eq("invoice_month", inv.month);
      }

      for (const [pattern, v] of learnPatterns) {
        await (supabase as any).from("ofx_category_rules").upsert({
          user_id: user.id, pattern, category: v.category, cat_type: v.cat_type,
        }, { onConflict: "user_id,pattern" });
      }
      await (supabase as any).from("ofx_imports").update({ imported_count: toInsert.length + toUpdate.length }).eq("id", imp.id);

      toast.success(`${toInsert.length + toUpdate.length} movimentações importadas do PDF.`);
      setOpen(false);
      setRows([]);
      for (const key of ["finances", "ofx_imports", "ofx_category_rules", "budgets", "jars", "investments", "savings_movements", "investment_movements", "accounts"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    } finally {
      setBusy(false);
    }
  };


  return (
    <>
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFile} />
      {asItem ? (
        <button onClick={() => fileRef.current?.click()} disabled={reading}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent disabled:opacity-60">
          {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType2 className="h-4 w-4 text-primary" />}
          {reading ? "Lendo PDF…" : "Importar PDF"}
        </button>
      ) : (
        <button onClick={() => fileRef.current?.click()} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent" title="Importar extrato PDF">
          {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType2 className="h-4 w-4" />}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <FileText className="h-5 w-5 text-primary" /> Conferir extrato PDF — {account.name}
            </DialogTitle>
          </DialogHeader>

          <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl bg-accent/40 p-3 text-sm md:grid-cols-5">
            <div><div className="text-xs text-muted-foreground">Banco</div><div className="truncate font-medium">{meta.bank ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Conta no extrato</div><div className="truncate font-medium">{meta.account ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Período</div>
              <div className="font-medium">{meta.start ? formatDateBR(meta.start) : "?"} — {meta.end ? formatDateBR(meta.end) : "?"}</div>
            </div>
            <div><div className="text-xs text-muted-foreground">Encontradas</div><div className="font-medium">{rows.length}</div></div>
            <div><div className="text-xs text-muted-foreground">Duplicadas</div><div className="font-medium">{dupCount}</div></div>
          </div>

          <p className="mb-2 text-xs text-muted-foreground">
            Confira cada linha antes de confirmar — nada é lançado sem sua confirmação. O arquivo <span className="font-medium">{fileName}</span> não altera o saldo por conta própria.
          </p>

          <div className="space-y-2">
            {rows.map((r, i) => {
              const isTransferKind = TRANSFER_KINDS.includes(r.kind);
              const wantType: Cat["type"] =
                r.kind === "income" ? "receita" :
                r.kind === "jar_deposit" || r.kind === "jar_withdraw" ? "reserva" :
                r.kind === "invest_in" || r.kind === "invest_out" ? "investimento" : "despesa";
              const opts = catOptions.filter(c => c.type === wantType);
              return (
                <div key={i} className={`cozy-card p-3 ${r.ignore ? "opacity-50" : ""} ${r.duplicate ? "border-amber-400/50" : ""}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[104px]">
                      <Input type="date" value={r.date} onChange={e => updateRow(i, { date: e.target.value })} className="h-8 text-xs" />
                      <div className="mt-1 flex items-center gap-1">
                        <select value={r.type} onChange={e => updateRow(i, { type: e.target.value as any, kind: e.target.value === "CREDIT" ? "income" : "expense" })}
                          className={`h-7 rounded-md border border-input bg-background px-1 text-[10px] ${r.type === "CREDIT" ? "text-emerald-600" : "text-rose-600"}`}>
                          <option value="CREDIT">+ Entrada</option>
                          <option value="DEBIT">− Saída</option>
                        </select>
                        <Input type="number" step="0.01" value={r.amount}
                          onChange={e => updateRow(i, { amount: Number(e.target.value) || 0 })} className="h-7 w-24 text-xs" />
                      </div>
                    </div>
                    <div className="min-w-[180px] flex-1">
                      <Input value={r.description} onChange={e => updateRow(i, { description: e.target.value })} className="h-8 text-xs" />
                      <div className="mt-1 truncate text-[10px] text-muted-foreground">
                        {r.memo}{r.doc ? ` · Doc ${r.doc}` : ""}
                        {r.balanceAfter !== null ? ` · Saldo ${fmtBRL(r.balanceAfter)}` : ""}
                      </div>
                    </div>
                    <div className="min-w-[170px]">
                      <select value={r.kind} onChange={e => setKind(i, e.target.value as Kind)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                        <option value={r.type === "CREDIT" ? "income" : "expense"}>{r.type === "CREDIT" ? "Receita" : "Despesa"}</option>
                        <option value="transfer">Transferência entre contas</option>
                        <option value="jar_deposit">Aporte em reserva</option>
                        <option value="jar_withdraw">Resgate de reserva</option>
                        <option value="invest_in">Aporte em investimento</option>
                        <option value="invest_out">Resgate de investimento</option>
                        {cards.length > 0 && <option value="card_payment">Pagamento de fatura</option>}
                      </select>
                      {isTransferKind && <div className="mt-1 text-[10px] text-sky-700">Transferência patrimonial · não entra em receita/despesa</div>}
                      {r.kind === "card_payment" && <div className="mt-1 text-[10px] text-sky-700">Quita a fatura · não cria despesa</div>}
                    </div>
                    <div className="min-w-[170px]">
                      {r.kind === "transfer" ? (
                        <select value={r.toAccountId} onChange={e => updateRow(i, { toAccountId: e.target.value })}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                          <option value="">Conta destino…</option>
                          {accounts.filter(a => a.id !== account.id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      ) : r.kind === "card_payment" ? (
                        <div className="space-y-1">
                          <select value={r.cardId} onChange={e => updateRow(i, { cardId: e.target.value })}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                            <option value="">Cartão…</option>
                            {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <select value={r.invoiceMonth} onChange={e => updateRow(i, { invoiceMonth: e.target.value })}
                            className="h-7 w-full rounded-md border border-input bg-background px-2 text-[10px]">
                            {Array.from({ length: 5 }).map((_, k) => {
                              const base = new Date(`${r.date}T12:00:00`);
                              const d = new Date(base.getFullYear(), base.getMonth() - 2 + k, 1);
                              const key = monthKey(d);
                              return <option key={key} value={key}>Fatura {labelMonth(key)}</option>;
                            })}
                          </select>
                        </div>
                      ) : isTransferKind ? (
                        <div className="text-[11px] text-muted-foreground">Transferência patrimonial</div>
                      ) : (
                        <select value={r.category} onChange={e => updateRow(i, { category: e.target.value })}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                          <option value="">Categoria…</option>
                          {opts.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {r.duplicate && (
                        <select value={r.duplicateAction} onChange={e => updateRow(i, { duplicateAction: e.target.value as any })}
                          className="h-7 rounded-md border border-amber-400/50 bg-amber-50 px-2 text-[10px] text-amber-900">
                          <option value="skip">Possível duplicada · Ignorar</option>
                          <option value="import">Importar mesmo assim</option>
                          <option value="update">Atualizar existente</option>
                        </select>
                      )}
                      <button onClick={() => updateRow(i, { ignore: !r.ignore })}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent" title="Ignorar movimentação">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {selected.length} para importar · {ignoredCount} ignoradas · {dupCount} duplicadas
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={runImport} disabled={busy || !selected.length} className="rounded-full">
                {busy ? "Importando…" : `Confirmar importação (${selected.length})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Importar Extrato" → OFX ou PDF */
export function ImportStatementMenu({ account, accounts, cats, cards = [] }:
  { account: Account; accounts: Account[]; cats: Cat[]; cards?: CardT[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent" title="Importar extrato">
          <Upload className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Importar extrato</div>
        <OFXImportButton account={account} accounts={accounts} cats={cats} asItem />
        <PDFImportButton account={account} accounts={accounts} cats={cats} cards={cards} asItem />
      </PopoverContent>
    </Popover>
  );
}
