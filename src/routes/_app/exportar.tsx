import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/cozy";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { localDateKey } from "@/lib/dates";

export const Route = createFileRoute("/_app/exportar")({ component: ExportarPage });

const TABLES = [
  { key: "diary_entries", label: "Diário" },
  { key: "habits", label: "Hábitos" },
  { key: "habit_logs", label: "Registros de hábitos" },
  { key: "podcast_shows", label: "Podcasts" },
  { key: "podcast_episodes", label: "Episódios" },
  { key: "series", label: "Séries" },
  { key: "movies", label: "Filmes" },
  { key: "books", label: "Livros" },
  { key: "events", label: "Agenda" },
  { key: "birthdays", label: "Aniversários" },
  { key: "finances", label: "Finanças" },
  { key: "goals", label: "Metas" },
] as const;

function ExportarPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const exportAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const wb = XLSX.utils.book_new();
      for (const t of TABLES) {
        const { data } = await supabase.from(t.key as any).select("*");
        const ws = XLSX.utils.json_to_sheet(data ?? []);
        XLSX.utils.book_append_sheet(wb, ws, t.label.slice(0, 31));
      }
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf], { type: "application/octet-stream" }),
        `entre-dias-${localDateKey()}.xlsx`);
      toast.success("Backup gerado ✨");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const exportOne = async (key: string, label: string) => {
    if (!user) return;
    const { data } = await supabase.from(key as any).select("*");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data ?? []), label.slice(0, 31));
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `${key}-${localDateKey()}.xlsx`);
  };

  return (
    <div>
      <PageHeader icon={Download} title="Exportar meus dados" subtitle="Backup completo em planilha." />
      <div className="cozy-card mb-6 flex items-center justify-between p-5">
        <div>
          <div className="font-display text-lg">Backup completo</div>
          <div className="text-sm text-muted-foreground">Todos os módulos em um único arquivo .xlsx</div>
        </div>
        <Button onClick={exportAll} disabled={loading} className="rounded-full">
          <Download className="mr-1 h-4 w-4" />{loading ? "Gerando…" : "Exportar tudo"}
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {TABLES.map((t) => (
          <div key={t.key} className="cozy-card flex items-center justify-between p-4">
            <div className="font-medium">{t.label}</div>
            <button onClick={() => exportOne(t.key, t.label)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent">
              <Download className="h-3 w-3" /> Exportar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
