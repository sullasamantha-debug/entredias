import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_diary_entry",
  title: "Criar entrada no diário",
  description: "Cria uma entrada no diário do usuário autenticado.",
  inputSchema: {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data da entrada (YYYY-MM-DD)."),
    title: z.string().trim().optional().describe("Título da entrada."),
    content: z.string().trim().optional().describe("Texto da entrada."),
    mood: z.number().int().min(1).max(5).optional().describe("Humor de 1 a 5."),
    energy: z.number().int().min(1).max(5).optional().describe("Energia de 1 a 5."),
    anxiety: z.number().int().min(1).max(5).optional().describe("Ansiedade de 1 a 5."),
    gratitude: z.string().trim().optional().describe("Gratidão do dia."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("diary_entries")
      .insert({
        user_id: ctx.getUserId(),
        date: input.date,
        title: input.title ?? null,
        content: input.content ?? null,
        mood: input.mood ?? null,
        energy: input.energy ?? null,
        anxiety: input.anxiety ?? null,
        gratitude: input.gratitude ?? null,
      })
      .select("id, date, title, mood");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data?.[0] ?? null) }],
      structuredContent: { entry: data?.[0] ?? null },
    };
  },
});
