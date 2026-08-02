import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "complete_event",
  title: "Concluir evento",
  description: "Marca um evento da agenda como concluído (ou reabre).",
  inputSchema: {
    id: z.string().uuid().describe("ID do evento."),
    completed: z.boolean().optional().describe("true para concluir (padrão), false para reabrir."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, completed }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("events")
      .update({ completed: completed ?? true })
      .eq("id", id)
      .select("id, title, date, completed");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data?.length) return { content: [{ type: "text", text: "Evento não encontrado." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data[0]) }],
      structuredContent: { event: data[0] },
    };
  },
});
