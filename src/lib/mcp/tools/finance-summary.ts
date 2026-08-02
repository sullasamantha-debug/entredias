import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "finance_summary",
  title: "Resumo financeiro do período",
  description: "Resume receitas, despesas e saldo das transações em um intervalo de datas, com totais por categoria.",
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data inicial (YYYY-MM-DD)."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data final (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("finances")
      .select("kind, amount, category, date")
      .gte("date", from)
      .lte("date", to)
      .limit(2000);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    let income = 0;
    let expense = 0;
    const byCategory: Record<string, number> = {};
    for (const r of rows) {
      const amount = Number(r.amount) || 0;
      if (r.kind === "income") income += amount;
      else if (r.kind === "expense") {
        expense += amount;
        const key = r.category ?? "Sem categoria";
        byCategory[key] = (byCategory[key] ?? 0) + amount;
      }
    }
    const summary = {
      from,
      to,
      transactions: rows.length,
      income: Number(income.toFixed(2)),
      expense: Number(expense.toFixed(2)),
      balance: Number((income - expense).toFixed(2)),
      expensesByCategory: Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([category, total]) => ({ category, total: Number(total.toFixed(2)) })),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
