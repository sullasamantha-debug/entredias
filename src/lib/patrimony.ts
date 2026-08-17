import { supabase } from "@/integrations/supabase/client";

/** Movimentações que apenas mudam o dinheiro de lugar dentro do patrimônio. */
export type PatKind = "jar_deposit" | "jar_withdraw" | "invest_in" | "invest_out";

export const PAT_KINDS: PatKind[] = ["jar_deposit", "jar_withdraw", "invest_in", "invest_out"];

export const PAT_LABEL: Record<PatKind, string> = {
  jar_deposit: "Aporte em reserva",
  jar_withdraw: "Resgate de reserva",
  invest_in: "Aporte em investimento",
  invest_out: "Resgate de investimento",
};

export const isJarKind = (k: PatKind) => k === "jar_deposit" || k === "jar_withdraw";
/** true quando o dinheiro SAI da conta (aplicação); false quando volta para a conta (resgate). */
export const isOutflowKind = (k: PatKind) => k === "jar_deposit" || k === "invest_in";

/** Descrições que sugerem aplicação/resgate em reserva ou investimento. */
const APP_RE = /aplica[çc][ãa]o|aplic\.|aplicacao autom|resgate|investimento|invest\.|aporte|poupan[çc]a|reserva|cdb\b|tesouro|renda fixa|fundo\s|previd[êe]ncia|lci\b|lca\b|cofrinho|caixinha/i;
const REDEEM_RE = /resgate|retirada|saque de aplica|liquida[çc][ãa]o/i;
const JAR_RE = /poupan[çc]a|reserva|cofrinho|caixinha/i;
const INV_RE = /investimento|invest\.|cdb\b|tesouro|renda fixa|fundo\s|previd[êe]ncia|lci\b|lca\b|a[çc][õo]es/i;

export type AppDetection = { isApplication: boolean; suggested: PatKind | null };

/** Detecta aplicações/resgates em uma linha de extrato (OFX ou PDF). */
export function detectApplication(description: string, type: "CREDIT" | "DEBIT"): AppDetection {
  const text = description || "";
  if (!APP_RE.test(text)) return { isApplication: false, suggested: null };
  const redeem = REDEEM_RE.test(text) || type === "CREDIT";
  const jar = JAR_RE.test(text);
  const inv = INV_RE.test(text);
  // Sem certeza sobre o destino → não assumir; apenas sinalizar.
  if (jar === inv) return { isApplication: true, suggested: null };
  if (jar) return { isApplication: true, suggested: redeem ? "jar_withdraw" : "jar_deposit" };
  return { isApplication: true, suggested: redeem ? "invest_out" : "invest_in" };
}

export function patLabelFor(kind: PatKind, targetName: string) {
  const isDeposit = isOutflowKind(kind);
  const what = isJarKind(kind) ? "Reserva" : "Investimento";
  return `${isDeposit ? "Aporte" : "Resgate"} em ${what} "${targetName}"`;
}

/** Caminho do dinheiro: conta → destino (aporte) ou destino → conta (resgate). */
export function patFlowLabel(kind: PatKind, targetName: string, accountName: string | null) {
  const target = `${isJarKind(kind) ? "Reserva" : "Investimento"} ${targetName}`;
  const acc = accountName ?? "Conta";
  return isOutflowKind(kind) ? `${acc} → ${target}` : `${target} → ${acc}`;
}

/** Linha do extrato (transferência patrimonial) de um aporte/resgate. */
export function patFinanceRow(
  userId: string,
  args: { kind: PatKind; amount: number; date: string; accountId: string | null; targetName: string; notes?: string | null; importId?: string | null },
) {
  const outflow = isOutflowKind(args.kind);
  return {
    user_id: userId,
    kind: "transfer",
    amount: args.amount,
    category: "transferência patrimonial",
    description: patLabelFor(args.kind, args.targetName),
    date: args.date,
    payment_method: "transferência",
    installments: 1,
    paid: true,
    account_id: outflow ? args.accountId : null,
    to_account_id: outflow ? null : args.accountId,
    notes: args.notes ?? null,
    ...(args.importId ? { ofx_import_id: args.importId } : {}),
  };
}


export const NEW_TARGET = "__new__";

export type Resolved = { kind: PatKind; targetId: string; targetName: string; isJar: boolean };

export type TargetRequest = { kind: PatKind; targetId: string; newName: string };

/**
 * Resolve o destino (reserva/investimento) de cada linha, criando novos quando pedido.
 * Retorna null nas posições sem destino definido.
 */
export async function resolveTargets(
  userId: string,
  requests: (TargetRequest | null)[],
  ctx: { jars: { id: string; name: string }[]; invs: { id: string; name: string }[] },
): Promise<(Resolved | null)[]> {
  const createdJars = new Map<string, { id: string; name: string }>();
  const createdInvs = new Map<string, { id: string; name: string }>();
  const out: (Resolved | null)[] = [];

  for (const req of requests) {
    if (!req || !req.targetId) { out.push(null); continue; }
    const jar = isJarKind(req.kind);
    if (req.targetId === NEW_TARGET) {
      const name = (req.newName || "").trim();
      if (!name) { out.push(null); continue; }
      const cache = jar ? createdJars : createdInvs;
      const key = name.toLowerCase();
      let created = cache.get(key);
      if (!created) {
        if (jar) {
          const { data } = await supabase.from("savings_jars")
            .insert({ user_id: userId, name, current_amount: 0 }).select("id, name").single();
          if (!data) { out.push(null); continue; }
          created = data as { id: string; name: string };
        } else {
          const { data } = await supabase.from("investments")
            .insert({ user_id: userId, name, invested_amount: 0, current_amount: 0, category: "outros" })
            .select("id, name").single();
          if (!data) { out.push(null); continue; }
          created = data as { id: string; name: string };
        }
        cache.set(key, created);
      }
      out.push({ kind: req.kind, targetId: created.id, targetName: created.name, isJar: jar });
      continue;
    }
    const found = jar ? ctx.jars.find(j => j.id === req.targetId) : ctx.invs.find(i => i.id === req.targetId);
    out.push(found ? { kind: req.kind, targetId: found.id, targetName: found.name, isJar: jar } : null);
  }
  return out;
}

export type EffectItem = {
  res: Resolved;
  amount: number;
  date: string;
  accountId: string | null;
  accountName: string | null;
};

/**
 * Aplica os efeitos das aplicações/resgates: atualiza saldos das reservas e
 * investimentos e grava o histórico de cada um (com origem/destino).
 */
export async function applyPatrimonyEffects(userId: string, items: EffectItem[]) {
  if (!items.length) return;

  const jarItems = items.filter(i => i.res.isJar);
  const invItems = items.filter(i => !i.res.isJar);

  if (jarItems.length) {
    const ids = Array.from(new Set(jarItems.map(i => i.res.targetId)));
    const { data: current } = await supabase.from("savings_jars").select("id, current_amount").in("id", ids);
    const balances = new Map<string, number>((current ?? []).map((j: any) => [j.id, Number(j.current_amount) || 0]));
    for (const it of jarItems) {
      const delta = isOutflowKind(it.res.kind) ? it.amount : -it.amount;
      balances.set(it.res.targetId, Math.max(0, (balances.get(it.res.targetId) ?? 0) + delta));
    }
    for (const id of ids) {
      await supabase.from("savings_jars").update({ current_amount: balances.get(id) ?? 0 }).eq("id", id);
    }
    await supabase.from("savings_movements").insert(jarItems.map(it => ({
      user_id: userId,
      jar_id: it.res.targetId,
      kind: isOutflowKind(it.res.kind) ? "deposit" : "withdraw",
      amount: it.amount,
      date: it.date,
      account_id: it.accountId,
      notes: it.accountName ? `${isOutflowKind(it.res.kind) ? "Origem" : "Destino"}: ${it.accountName}` : null,
    })) as any);
  }

  if (invItems.length) {
    const ids = Array.from(new Set(invItems.map(i => i.res.targetId)));
    const { data: current } = await supabase.from("investments").select("id, invested_amount, current_amount").in("id", ids);
    const state = new Map<string, { invested: number; cur: number }>(
      (current ?? []).map((i: any) => [i.id, { invested: Number(i.invested_amount) || 0, cur: Number(i.current_amount) || 0 }]),
    );
    for (const it of invItems) {
      const s = state.get(it.res.targetId) ?? { invested: 0, cur: 0 };
      if (isOutflowKind(it.res.kind)) {
        s.invested += it.amount; s.cur += it.amount;
      } else {
        s.cur = Math.max(0, s.cur - it.amount);
        s.invested = Math.max(0, s.invested - it.amount);
      }
      state.set(it.res.targetId, s);
    }
    for (const id of ids) {
      const s = state.get(id);
      if (!s) continue;
      await supabase.from("investments").update({ invested_amount: s.invested, current_amount: s.cur }).eq("id", id);
    }
    await (supabase as any).from("investment_movements").insert(invItems.map(it => ({
      user_id: userId,
      investment_id: it.res.targetId,
      kind: isOutflowKind(it.res.kind) ? "deposit" : "withdraw",
      amount: it.amount,
      date: it.date,
      account_id: it.accountId,
      notes: it.accountName ? `${isOutflowKind(it.res.kind) ? "Origem" : "Destino"}: ${it.accountName}` : null,
    })));
  }
}
