import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_event",
  title: "Criar evento na agenda",
  description: "Cria um novo evento na agenda do usuário autenticado.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Título do evento."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data do evento (YYYY-MM-DD)."),
    time: z.string().trim().optional().describe("Horário em texto livre, ex: '14:30'."),
    type: z.string().trim().optional().describe("Tipo do evento, ex: 'evento', 'compromisso'."),
    description: z.string().trim().optional().describe("Descrição adicional."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, date, time, type, description }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("events")
      .insert({
        user_id: ctx.getUserId(),
        title,
        date,
        time_str: time ?? null,
        type: type ?? "evento",
        description: description ?? null,
      })
      .select("id, title, date, time_str, type, description, completed");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data?.[0] ?? null) }],
      structuredContent: { event: data?.[0] ?? null },
    };
  },
});
