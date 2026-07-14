import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/cozy";
import { Calendar, Cake, Sparkles } from "lucide-react";
import { format, addYears, isAfter, subDays, differenceInCalendarDays, startOfWeek, endOfWeek, isSameDay, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
// no-op
import { ptBR } from "date-fns/locale";
import { formatDateOnly, localDateKey, parseDateOnly } from "@/lib/dates";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const today = new Date();
  const currentYear = today.getFullYear();
  const [year, setYear] = useState(currentYear);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const monthStartKey = `${year}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEndKey = `${year}-${String(today.getMonth() + 1).padStart(2, "0")}-31`;

  const { data } = useQuery({
    enabled: !!user,
    queryKey: ["dashboard", user?.id, year],
    queryFn: async () => {
      const [episodes, movies, series, books, events, birthdays] = await Promise.all([
        supabase.from("podcast_episodes").select("id, show_id, status, listened_date").eq("status", "listened").gte("listened_date", yearStart).lte("listened_date", yearEnd),
        supabase.from("movies").select("id, watched_date").gte("watched_date", yearStart).lte("watched_date", yearEnd),
        supabase.from("series").select("id, status, kind, end_date").eq("status", "finalizada").gte("end_date", yearStart).lte("end_date", yearEnd),
        supabase.from("books").select("id, status, end_date").eq("status", "concluido").gte("end_date", yearStart).lte("end_date", yearEnd),
        supabase.from("events").select("*").gte("date", localDateKey(today)).eq("completed", false).order("date").limit(6),
        supabase.from("birthdays").select("*"),
      ]);
      return {
        episodes: (episodes.data ?? []) as { id: string; show_id: string | null; listened_date: string | null }[],
        movies: movies.data ?? [],
        series: series.data ?? [],
        books: books.data ?? [],
        events: events.data ?? [],
        birthdays: birthdays.data ?? [],
      };
    },
  });

  const episodesInMonth = (data?.episodes ?? []).filter(e => e.listened_date && e.listened_date >= monthStartKey && e.listened_date <= monthEndKey).length;
  const podcastsInYear = new Set((data?.episodes ?? []).map(e => e.show_id).filter(Boolean)).size;
  const monthLabel = format(new Date(year, today.getMonth(), 1), "MMMM/yyyy", { locale: ptBR });

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const cards = [
    { emoji: "🎧", label: "Podcasts", value: data?.episodes.length ?? 0, unit: "podcasts ouvidos" },
    { emoji: "🎬", label: "Filmes", value: data?.movies.length ?? 0, unit: "filmes assistidos" },
    { emoji: "📺", label: "Séries", value: data?.series.length ?? 0, unit: "séries concluídas" },
    { emoji: "📚", label: "Livros", value: data?.books.length ?? 0, unit: "livros concluídos" },
  ];

  // Birthdays with next occurrence + day metadata
  const bdays = (data?.birthdays ?? []).map((b) => {
    const d = parseDateOnly(b.date);
    let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (!isAfter(next, subDays(today, 1))) next = addYears(next, 1);
    return { ...b, next, days: differenceInCalendarDays(next, today) };
  }).sort((a, b) => a.days - b.days);

  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const bdaysToday = bdays.filter((b) => isSameDay(b.next, today));
  const bdaysWeek = bdays.filter((b) => isWithinInterval(b.next, { start: weekStart, end: weekEnd }) && !isSameDay(b.next, today));
  const bdaysMonth = bdays.filter((b) => isWithinInterval(b.next, { start: monthStart, end: monthEnd }) && !isWithinInterval(b.next, { start: weekStart, end: weekEnd }));
  const bdaysUpcoming = bdays.filter((b) => b.days > 0 && !isWithinInterval(b.next, { start: monthStart, end: monthEnd })).slice(0, 4);

  const eventsToday = (data?.events ?? []).filter((e) => e.date === localDateKey(today));

  return (
    <div>
      <PageHeader
        icon={Sparkles}
        title={`Olá, ${user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "você"} ✿`}
        subtitle={format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
      />

      {/* Minha Jornada */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Minha Jornada</h2>
            <p className="text-sm text-muted-foreground">Momentos vividos ao longo do ano</p>
          </div>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {cards.map((c) => (
            <motion.div key={c.label} whileHover={{ y: -3 }} className="cozy-card p-5">
              <div className="text-3xl">{c.emoji}</div>
              <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
              <div className="mt-1 font-display text-4xl leading-none">{c.value}</div>
              <div className="mt-2 text-xs text-muted-foreground">{c.unit} em {year}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Eventos */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="cozy-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg">Agenda</h3>
            </div>
            <Link to="/agenda" className="text-xs text-primary hover:underline">Ver agenda completa →</Link>
          </div>

          {eventsToday.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Hoje</div>
              <ul className="space-y-2">
                {eventsToday.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{e.title}</div>
                      {e.time_str && <div className="text-xs text-muted-foreground">{e.time_str}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Próximos</div>
          {data?.events.length ? (
            <ul className="space-y-2">
              {data.events.filter((e) => e.date !== localDateKey(today)).slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-blush/30 text-center">
                    <div className="font-display text-sm leading-none">{formatDateOnly(e.date, "d")}</div>
                    <div className="text-[9px] uppercase text-muted-foreground">{formatDateOnly(e.date, "MMM", { locale: ptBR })}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.title}</div>
                    {e.time_str && <div className="text-xs text-muted-foreground">{e.time_str}</div>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum evento. Que sossego.</p>
          )}
        </motion.div>

        {/* Aniversários */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="cozy-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Cake className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg">Aniversários</h3>
          </div>

          {bdaysToday.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">🎂 Hoje</div>
              <div className="grid gap-2">
                {bdaysToday.map((b) => (
                  <div key={b.id} className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <div className="font-display text-base">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{b.category}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bdaysWeek.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Esta semana</div>
              <ul className="space-y-1.5">
                {bdaysWeek.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-xs text-primary">{format(b.next, "EEE, d MMM", { locale: ptBR })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bdaysMonth.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Este mês</div>
              <ul className="space-y-1.5">
                {bdaysMonth.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-xs text-muted-foreground">{format(b.next, "d MMM", { locale: ptBR })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bdaysUpcoming.length > 0 && (
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Próximos</div>
              <ul className="space-y-1.5">
                {bdaysUpcoming.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-xs text-muted-foreground">em {b.days} dias</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!bdaysToday.length && !bdaysWeek.length && !bdaysMonth.length && !bdaysUpcoming.length && (
            <p className="text-sm text-muted-foreground">Adicione aniversários para receber lembretes.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
