import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_books",
  title: "Listar livros",
  description: "Lista os livros da biblioteca do usuário, com filtro opcional por status.",
  inputSchema: {
    status: z.enum(["lendo", "concluido", "quero_ler", "pausado", "abandonado"]).optional().describe("Filtrar por status."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de livros. Padrão: 25."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("books")
      .select("id, title, author, status, rating, start_date, end_date, pages, category")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { books: data ?? [] },
    };
  },
});
