import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEventsTool from "./tools/list-events";
import createEventTool from "./tools/create-event";
import completeEventTool from "./tools/complete-event";
import listBooksTool from "./tools/list-books";
import addBookTool from "./tools/add-book";
import listDiaryEntriesTool from "./tools/list-diary-entries";
import createDiaryEntryTool from "./tools/create-diary-entry";
import financeSummaryTool from "./tools/finance-summary";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "life-compass",
  title: "Life Compass",
  version: "0.1.0",
  instructions:
    "Ferramentas do journal pessoal Life Compass. Use list_events/create_event/complete_event para a agenda, list_books/add_book para a biblioteca de livros, list_diary_entries/create_diary_entry para o diário e finance_summary para um resumo financeiro por período. Todas as datas usam o formato YYYY-MM-DD e todos os dados são do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listEventsTool,
    createEventTool,
    completeEventTool,
    listBooksTool,
    addBookTool,
    listDiaryEntriesTool,
    createDiaryEntryTool,
    financeSummaryTool,
  ],
});
