import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, ArrowRightLeft, PiggyBank, LineChart, X, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, invoiceMonthFor, labelMonth } from "@/lib/finance";
import { formatDateBR } from "@/lib/dates";
import { parseOFX, suggestCategory, type OFXTx, type SuggestionRule } from "@/lib/ofx";
import { memoPattern } from "@/lib/ofx";
import { CreditCard } from "lucide-react";

type Cat = { id: string; name: string; type: "receita" | "despesa" | "reserva" | "investimento"; archived: boolean };
type Account = { id: string; name: string };

type Row = {
  fitid: string | null;
  date: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  memo: string;
  checknum: string | null;
  description: string;
  category: string;
  cat_type: "receita" | "despesa" | "reserva" | "investimento";
  kind: "income" | "expense" | "transfer" | "jar_deposit" | "jar_withdraw" | "invest_in" | "invest_out";
  ignore: boolean;
  duplicate: boolean;
  duplicateId: string | null;
  duplicateAction: "skip" | "import" | "update";
  toAccountId: string;
};

export function OFXImportButton({ account, accounts, cats }:
  { account: Account; accounts: Account[]; cats: Cat[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [period, setPeriod] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const { data: rules } = useQuery({
    enabled: !!user && open,
    queryKey: ["ofx_category_rules", user?.id],
    queryFn: async () => (((await (supabase as any).from("ofx_category_rules").select("pattern, category, cat_type")).data) ?? []) as SuggestionRule[],
  });

  const pickFile = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setFileName(file.name);
    let text = "";
    try {
      const buf = await file.arrayBuffer();
      // Try UTF-8 first; fallback to latin1 for old OFX files
      text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      if (/�/.test(text)) text = new TextDecoder("latin1").decode(buf);
    } catch {
      text = await file.text();
    }
    const parsed = parseOFX(text);
    if (!parsed.transactions.length) {
      toast.error("Nenhuma movimentação encontrada no arquivo.");
      return;
    }

    // Fetch existing finances for this account & fitids/date+amount for duplicate check
    const fitids = parsed.transactions.map(t => t.fitid).filter(Boolean) as string[];
    const dates = Array.from(new Set(parsed.transactions.map(t => t.date)));
    const { data: existingByFitid } = fitids.length
      ? await supabase.from("finances").select("id, fitid, date, amount, description")
          .eq("account_id", account.id).in("fitid", fitids)
      : { data: [] as any[] };
    const { data: existingByDate } = await supabase.from("finances").select("id, fitid, date, amount, description")
      .eq("account_id", account.id).in("date", dates);

    const byFitid = new Map<string, string>();
    (existingByFitid ?? []).forEach((r: any) => { if (r.fitid) byFitid.set(r.fitid, r.id); });
    const byDateAmt = new Map<string, string>();
    (existingByDate ?? []).forEach((r: any) => byDateAmt.set(`${r.date}|${Number(r.amount).toFixed(2)}`, r.id));

    const learned = rules ?? [];
    const newRows: Row[] = parsed.transactions.map((t: OFXTx) => {
      const s = suggestCategory(t.memo, t.type, learned);
      let dupId: string | null = null;
      if (t.fitid && byFitid.has(t.fitid)) dupId = byFitid.get(t.fitid)!;
      else {
        const key = `${t.date}|${Math.abs(t.amount).toFixed(2)}`;
        if (byDateAmt.has(key)) dupId = byDateAmt.get(key)!;
      }
      const kind: Row["kind"] = t.type === "CREDIT" ? "income" : "expense";
      const suggestedCat = s.isCardPayment ? "Pagamento de Fatura" : (s.category ?? "");
      return {
        fitid: t.fitid,
        date: t.date,
        amount: Math.abs(t.amount),
        type: t.type,
        memo: t.memo,
        checknum: t.checknum,
        description: t.memo,
        category: suggestedCat,
        cat_type: s.cat_type,
        kind,
        ignore: false,
        duplicate: !!dupId,
        duplicateId: dupId,
        duplicateAction: "skip",
        toAccountId: "",
      };
    });
    setRows(newRows);
    setPeriod({ start: parsed.periodStart, end: parsed.periodEnd });
    setOpen(true);
    e.target.value = "";
  };

  const selected = rows.filter(r => !r.ignore && !(r.duplicate && r.duplicateAction === "skip"));
  const dupCount = rows.filter(r => r.duplicate).length;
  const ignoredCount = rows.filter(r => r.ignore).length;

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };

  const setKind = (i: number, kind: Row["kind"]) => {
    // Adjust cat_type expectations for the picker
    const cat_type: Row["cat_type"] =
      kind === "income" ? "receita" :
      kind === "jar_deposit" || kind === "jar_withdraw" ? "reserva" :
      kind === "invest_in" || kind === "invest_out" ? "investimento" :
      kind === "transfer" ? "despesa" : "despesa";
    updateRow(i, { kind, cat_type, category: kind === "transfer" ? "transferência patrimonial" : "" });
  };

  const runImport = async () => {
    if (!user) return;
    setBusy(true);
    try {
      // Create import record first
      const { data: imp, error: iErr } = await (supabase as any).from("ofx_imports").insert({
        user_id: user.id, account_id: account.id, file_name: fileName,
        period_start: period.start, period_end: period.end,
        imported_count: 0, skipped_count: ignoredCount, duplicate_count: dupCount,
      }).select("id").single();
      if (iErr || !imp) { toast.error(iErr?.message ?? "Falha ao registrar importação."); setBusy(false); return; }

      const toInsert: any[] = [];
      const toUpdate: { id: string; patch: any }[] = [];
      const learnPatterns = new Map<string, { category: string; cat_type: string }>();

      for (const r of selected) {
        const isTransferKind =
          r.kind === "transfer" || r.kind === "jar_deposit" || r.kind === "jar_withdraw" ||
          r.kind === "invest_in" || r.kind === "invest_out";
        const category = isTransferKind ? "transferência patrimonial" : (r.category || null);
        const kindStored =
          r.kind === "income" ? "income" :
          r.kind === "expense" ? "expense" : "transfer";
        const row = {
          user_id: user.id,
          kind: kindStored,
          amount: r.amount,
          category,
          description: r.description || null,
          date: r.date,
          payment_method: kindStored === "transfer" ? "transferência" : "débito",
          installments: 1,
          notes: r.checknum ? `Doc: ${r.checknum}` : null,
          paid: true,
          account_id: account.id,
          to_account_id: kindStored === "transfer" ? (r.toAccountId || null) : null,
          fitid: r.fitid,
          ofx_import_id: imp.id,
        };
        if (r.duplicate && r.duplicateAction === "update" && r.duplicateId) {
          toUpdate.push({ id: r.duplicateId, patch: row });
        } else if (!r.duplicate || r.duplicateAction === "import") {
          toInsert.push(row);
          // Learn: only when not a transfer and category is set
          if (!isTransferKind && r.category) {
            const p = memoPattern(r.memo);
            if (p && !learnPatterns.has(p)) learnPatterns.set(p, { category: r.category, cat_type: r.cat_type });
          }
        }
      }

      if (toInsert.length) {
        const { error } = await supabase.from("finances").insert(toInsert);
        if (error) { toast.error(error.message); setBusy(false); return; }
      }
      for (const u of toUpdate) {
        await supabase.from("finances").update(u.patch).eq("id", u.id);
      }

      // Persist learned rules (upsert by unique (user_id, pattern))
      for (const [pattern, v] of learnPatterns) {
        await (supabase as any).from("ofx_category_rules").upsert({
          user_id: user.id, pattern, category: v.category, cat_type: v.cat_type,
        }, { onConflict: "user_id,pattern" });
      }

      // Update import counts
      await (supabase as any).from("ofx_imports").update({
        imported_count: toInsert.length + toUpdate.length,
      }).eq("id", imp.id);

      toast.success(`${toInsert.length + toUpdate.length} movimentações importadas.`);
      setOpen(false);
      setRows([]);
      qc.invalidateQueries({ queryKey: ["finances"] });
      qc.invalidateQueries({ queryKey: ["ofx_imports"] });
      qc.invalidateQueries({ queryKey: ["ofx_category_rules"] });
    } finally {
      setBusy(false);
    }
  };

  const catOptions = useMemo(() => cats.filter(c => !c.archived), [cats]);

  return (
    <>
      <input ref={fileRef} type="file" accept=".ofx,.OFX,text/plain" className="hidden" onChange={onFile} />
      <button
        onClick={pickFile}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
        title="Importar extrato OFX"
      >
        <Upload className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <FileText className="h-5 w-5 text-primary" /> Importar extrato — {account.name}
            </DialogTitle>
          </DialogHeader>

          <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl bg-accent/40 p-3 text-sm md:grid-cols-4">
            <div><div className="text-xs text-muted-foreground">Arquivo</div><div className="truncate font-medium">{fileName}</div></div>
            <div><div className="text-xs text-muted-foreground">Movimentações</div><div className="font-medium">{rows.length}</div></div>
            <div><div className="text-xs text-muted-foreground">Período</div>
              <div className="font-medium">{period.start ? formatDateBR(period.start) : "?"} — {period.end ? formatDateBR(period.end) : "?"}</div>
            </div>
            <div><div className="text-xs text-muted-foreground">Duplicadas</div><div className="font-medium">{dupCount}</div></div>
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => {
              const isTransferKind =
                r.kind === "transfer" || r.kind === "jar_deposit" || r.kind === "jar_withdraw" ||
                r.kind === "invest_in" || r.kind === "invest_out";
              const wantType: Cat["type"] =
                r.kind === "income" ? "receita" :
                r.kind === "jar_deposit" || r.kind === "jar_withdraw" ? "reserva" :
                r.kind === "invest_in" || r.kind === "invest_out" ? "investimento" : "despesa";
              const opts = catOptions.filter(c => c.type === wantType);
              return (
                <div key={i} className={`cozy-card p-3 ${r.ignore ? "opacity-50" : ""} ${r.duplicate ? "border-amber-400/50" : ""}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[92px]">
                      <Input type="date" value={r.date} onChange={e => updateRow(i, { date: e.target.value })} className="h-8 text-xs" />
                      <div className={`mt-1 text-xs ${r.type === "CREDIT" ? "text-emerald-600" : "text-rose-600"}`}>
                        {r.type === "CREDIT" ? "+" : "−"} {fmtBRL(r.amount)}
                      </div>
                    </div>
                    <div className="min-w-[180px] flex-1">
                      <Input value={r.description} onChange={e => updateRow(i, { description: e.target.value })} className="h-8 text-xs" />
                      <div className="mt-1 truncate text-[10px] text-muted-foreground">{r.memo}{r.checknum ? ` · Doc ${r.checknum}` : ""}{r.fitid ? ` · FITID ${r.fitid.slice(0, 12)}` : ""}</div>
                    </div>
                    <div className="min-w-[160px]">
                      <select value={r.kind} onChange={e => setKind(i, e.target.value as Row["kind"])}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                        <option value={r.type === "CREDIT" ? "income" : "expense"}>
                          {r.type === "CREDIT" ? "Entrada" : "Saída"}
                        </option>
                        <option value="transfer">Transferência</option>
                        <option value="jar_deposit">Aporte em reserva</option>
                        <option value="jar_withdraw">Resgate de reserva</option>
                        <option value="invest_in">Aporte em investimento</option>
                        <option value="invest_out">Resgate de investimento</option>
                      </select>
                    </div>
                    <div className="min-w-[160px]">
                      {isTransferKind ? (
                        <select value={r.toAccountId} onChange={e => updateRow(i, { toAccountId: e.target.value })}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                          <option value="">Conta destino…</option>
                          {accounts.filter(a => a.id !== account.id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
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
                          <option value="skip">Já importada · Ignorar</option>
                          <option value="import">Importar mesmo assim</option>
                          <option value="update">Atualizar existente</option>
                        </select>
                      )}
                      <button onClick={() => updateRow(i, { ignore: !r.ignore })}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent" title="Ignorar">
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
                {busy ? "Importando…" : `Importar ${selected.length}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// -----------------------------------------------------------
// Import history + undo
type ImportRow = {
  id: string; account_id: string | null; file_name: string | null;
  period_start: string | null; period_end: string | null;
  imported_count: number; skipped_count: number; duplicate_count: number;
  created_at: string;
};

export function OFXImportsHistory({ accounts }: { accounts: Account[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: imports } = useQuery({
    enabled: !!user,
    queryKey: ["ofx_imports", user?.id],
    queryFn: async () => (((await (supabase as any).from("ofx_imports").select("*").order("created_at", { ascending: false })).data) ?? []) as ImportRow[],
  });

  const undo = async (id: string) => {
    await supabase.from("finances").delete().eq("ofx_import_id", id);
    await (supabase as any).from("ofx_imports").delete().eq("id", id);
    setConfirmId(null);
    toast.success("Importação desfeita.");
    qc.invalidateQueries({ queryKey: ["finances"] });
    qc.invalidateQueries({ queryKey: ["ofx_imports"] });
  };

  const list = imports ?? [];
  if (!list.length) return null;

  const accName = (id: string | null) => accounts.find(a => a.id === id)?.name ?? "—";

  return (
    <div className="mt-8 cozy-card p-5">
      <div className="mb-3 flex items-center gap-2 font-display text-lg">
        <FileText className="h-4 w-4 text-primary" /> Histórico de importações
      </div>
      <div className="space-y-2">
        {list.map(imp => (
          <div key={imp.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent/40 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{imp.file_name ?? "(sem nome)"}</div>
              <div className="text-xs text-muted-foreground">
                {formatDateBR(imp.created_at.slice(0, 10))} · {accName(imp.account_id)}
                {imp.period_start && imp.period_end && ` · ${formatDateBR(imp.period_start)}—${formatDateBR(imp.period_end)}`}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-700">{imp.imported_count} importadas</span>
              <span className="text-muted-foreground">{imp.skipped_count} ignoradas</span>
              <span className="text-amber-700">{imp.duplicate_count} duplicadas</span>
              <button onClick={() => setConfirmId(imp.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive" title="Desfazer importação">
                <Undo2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Desfazer importação?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Todas as movimentações criadas por esta importação serão removidas. Esta ação não pode ser desfeita.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmId && undo(confirmId)}>Desfazer</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* silence unused icons */}
      <span className="hidden"><ArrowRightLeft /><PiggyBank /><LineChart /></span>
    </div>
  );
}
