import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_book",
  title: "Adicionar livro",
  description: "Adiciona um livro à biblioteca do usuário autenticado.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Título do livro."),
    author: z.string().trim().optional().describe("Autor."),
    status: z.enum(["lendo", "concluido", "quero_ler", "pausado", "abandonado"]).optional().describe("Status. Padrão: lendo."),
    pages: z.number().int().min(1).optional().describe("Número de páginas."),
    category: z.string().trim().optional().describe("Categoria/gênero."),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data de início (YYYY-MM-DD)."),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data de conclusão (YYYY-MM-DD)."),
    rating: z.number().int().min(1).max(5).optional().describe("Nota de 1 a 5."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("books")
      .insert({
        user_id: ctx.getUserId(),
        title: input.title,
        author: input.author ?? null,
        status: input.status ?? "lendo",
        pages: input.pages ?? null,
        category: input.category ?? null,
        start_date: input.startDate ?? null,
        end_date: input.endDate ?? null,
        rating: input.rating ?? null,
      })
      .select("id, title, author, status, rating");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data?.[0] ?? null) }],
      structuredContent: { book: data?.[0] ?? null },
    };
  },
});
