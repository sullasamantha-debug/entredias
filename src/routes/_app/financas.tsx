import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, EmptyState, StatCard } from "@/components/cozy";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TagInput, TagBadges } from "@/components/TagInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wallet, Plus, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

export const Route = createFileRoute("/_app/financas")({ component: FinancasPage });

type Fin = {
  id: string; kind: string; amount: number; category: string | null; description: string | null;
  date: string; payment_method: string | null; installments: number | null; notes: string | null; tags: string[] | null;
};

const PAY = ["pix", "crédito", "débito", "dinheiro"];
const empty = () => ({
  kind: "expense", amount: 0, category: "", description: "",
  date: format(new Date(), "yyyy-MM-dd"), payment_method: "pix", installments: 1, notes: "", tags: [] as string[],
});

function fmtBRL(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function FinancasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Fin | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(empty());

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      kind: editing.kind, amount: Number(editing.amount), category: editing.category ?? "",
      description: editing.description ?? "", date: editing.date,
      payment_method: editing.payment_method ?? "pix", installments: editing.installments ?? 1,
      notes: editing.notes ?? "", tags: editing.tags ?? [],
    } : empty());
  }, [open, editing]);

  const { data: list } = useQuery({
    enabled: !!user, queryKey: ["finances", user?.id],
    queryFn: async () => ((await supabase.from("finances").select("*").order("date", { ascending: false })).data ?? []) as Fin[],
  });

  const save = async () => {
    if (!user || !form.amount) return;
    const { error } = editing
      ? await supabase.from("finances").update(form).eq("id", editing.id)
      : await supabase.from("finances").insert({ ...form, user_id: user.id });
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

  const now = new Date();
  const s = startOfMonth(now), e = endOfMonth(now);
  const month = (list ?? []).filter((x) => new Date(x.date) >= s && new Date(x.date) <= e);
  const income = month.filter((x) => x.kind === "income").reduce((a, x) => a + Number(x.amount), 0);
  const expense = month.filter((x) => x.kind === "expense").reduce((a, x) => a + Number(x.amount), 0);
  const cats = month.filter((x) => x.kind === "expense").reduce<Record<string, number>>((acc, x) => {
    const k = x.category || "—"; acc[k] = (acc[k] ?? 0) + Number(x.amount); return acc;
  }, {});
  const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <PageHeader icon={Wallet} title="Finanças" subtitle="Registros leves de entradas e saídas."
        action={<Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Novo registro</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
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
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={(ev) => setForm({ ...form, amount: +ev.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={form.date} onChange={(ev) => setForm({ ...form, date: ev.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label><Input value={form.category} onChange={(ev) => setForm({ ...form, category: ev.target.value })} placeholder="alimentação…" /></div>
              <div><Label>Forma</Label>
                <select value={form.payment_method} onChange={(ev) => setForm({ ...form, payment_method: ev.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {PAY.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div><Label>Parcelas</Label><Input type="number" min={1} value={form.installments} onChange={(ev) => setForm({ ...form, installments: +ev.target.value })} /></div>
            <div><Label>Descrição</Label><Input value={form.description} onChange={(ev) => setForm({ ...form, description: ev.target.value })} /></div>
            <div><Label>Tags</Label><TagInput value={form.tags} onChange={(t) => setForm({ ...form, tags: t })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(ev) => setForm({ ...form, notes: ev.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Entradas do mês" value={fmtBRL(income)} icon={TrendingUp} tint="mint" />
        <StatCard label="Saídas do mês" value={fmtBRL(expense)} icon={TrendingDown} tint="blush" />
        <StatCard label="Saldo" value={fmtBRL(income - expense)} tint="primary" />
        <StatCard label="Top categoria" value={topCat?.[0] ?? "—"} hint={topCat ? fmtBRL(topCat[1]) : ""} tint="sand" />
      </div>

      {!list?.length ? <EmptyState title="Comece registrando hoje" description="Pequenos gastos contam." /> : (
        <div className="space-y-2">
          {list.map((x, i) => (
            <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="cozy-card flex items-center gap-3 p-4">
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${x.kind === "income" ? "bg-mint/40" : "bg-blush/40"}`}>
                {x.kind === "income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{x.description || x.category || "Registro"}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(x.date), "dd/MM/yyyy")}</span>
                  {x.category && <span>· {x.category}</span>}
                  {x.payment_method && <span>· {x.payment_method}</span>}
                  {x.installments && x.installments > 1 ? <span>· {x.installments}x</span> : null}
                </div>
                <div className="mt-1"><TagBadges tags={x.tags} /></div>
              </div>
              <div className={`font-display text-lg ${x.kind === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                {x.kind === "income" ? "+" : "−"} {fmtBRL(Number(x.amount))}
              </div>
              <button onClick={() => { setEditing(x); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => setConfirmId(x.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove} title="Excluir registro?" />
    </div>
  );
}
