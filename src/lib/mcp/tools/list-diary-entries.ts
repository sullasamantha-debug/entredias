import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_diary_entries",
  title: "Listar entradas do diário",
  description: "Lista entradas do diário do usuário em um intervalo de datas.",
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial (YYYY-MM-DD)."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(50).optional().describe("Máximo de entradas. Padrão: 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("diary_entries")
      .select("id, date, title, content, mood, energy, anxiety, gratitude, rating, favorite")
      .order("date", { ascending: false })
      .limit(limit ?? 10);
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { entries: data ?? [] },
    };
  },
});
