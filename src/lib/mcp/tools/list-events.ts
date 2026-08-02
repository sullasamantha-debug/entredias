import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_events",
  title: "Listar eventos da agenda",
  description: "Lista os próximos eventos da agenda do usuário autenticado.",
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial (YYYY-MM-DD). Padrão: hoje."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final (YYYY-MM-DD)."),
    includeCompleted: z.boolean().optional().describe("Incluir eventos concluídos. Padrão: false."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de eventos. Padrão: 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, includeCompleted, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("events")
      .select("id, title, date, time_str, type, description, completed")
      .gte("date", from ?? new Date().toISOString().slice(0, 10))
      .order("date")
      .limit(limit ?? 20);
    if (to) q = q.lte("date", to);
    if (!includeCompleted) q = q.eq("completed", false);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { events: data ?? [] },
    };
  },
});
