import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, StatCard } from "@/components/cozy";
import {
  Activity, BookHeart, Mic, Tv, Film, BookOpen, Calendar, Cake, Sparkles, Heart,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subDays, isSameDay, differenceInCalendarDays, addYears, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDateOnly, localDateKey, parseDateOnly } from "@/lib/dates";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

  const { data } = useQuery({
    enabled: !!user,
    queryKey: ["dashboard", user?.id],
    queryFn: async () => {
      const [habits, habitLogs, podcasts, movies, series, books, events, birthdays, diary] = await Promise.all([
        supabase.from("habits").select("*").eq("archived", false),
        supabase.from("habit_logs").select("*").gte("date", format(subDays(today, 120), "yyyy-MM-dd")),
        supabase.from("podcasts").select("*").gte("date", monthStart).lte("date", monthEnd),
        supabase.from("movies").select("*").gte("watched_date", monthStart).lte("watched_date", monthEnd),
        supabase.from("series").select("episodes_watched, status"),
        supabase.from("books").select("status, end_date").eq("status", "concluido"),
        supabase.from("events").select("*").gte("date", localDateKey(today)).order("date").limit(5),
        supabase.from("birthdays").select("*"),
        supabase.from("diary_entries").select("date, mood, rating").gte("date", monthStart).lte("date", monthEnd),
      ]);
      return {
        habits: habits.data ?? [],
        habitLogs: habitLogs.data ?? [],
        podcasts: podcasts.data ?? [],
        movies: movies.data ?? [],
        series: series.data ?? [],
        books: books.data ?? [],
        events: events.data ?? [],
        birthdays: birthdays.data ?? [],
        diary: diary.data ?? [],
      };
    },
  });

  const todayStr = localDateKey(today);
  const habitsToday = data?.habitLogs.filter((l) => l.date === todayStr && l.done).length ?? 0;
  const totalHabits = data?.habits.length ?? 0;
  const episodes = data?.series.reduce((sum, s) => sum + (s.episodes_watched ?? 0), 0) ?? 0;

  // Streak: count consecutive days from today with at least one habit log
  const streak = (() => {
    if (!data) return 0;
    let s = 0;
    for (let i = 0; i < 120; i++) {
      const d = localDateKey(subDays(today, i));
      if (data.habitLogs.some((l) => l.date === d && l.done)) s++;
      else if (i > 0) break;
    }
    return s;
  })();

  const avgMood = (() => {
    const ms = (data?.diary ?? []).filter((d) => d.mood != null);
    if (!ms.length) return "—";
    return (ms.reduce((s, d) => s + (d.mood ?? 0), 0) / ms.length).toFixed(1);
  })();

  // Heatmap last 120 days
  const days = eachDayOfInterval({ start: subDays(today, 119), end: today });
  const heat = days.map((d) => {
    const k = localDateKey(d);
    const count = data?.habitLogs.filter((l) => l.date === k && l.done).length ?? 0;
    return { date: k, count };
  });

  // Monthly chart: habits done per day in current month
  const monthDays = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) });
  const monthChart = monthDays.map((d) => {
    const k = localDateKey(d);
    return {
      day: format(d, "d"),
      habitos: data?.habitLogs.filter((l) => l.date === k && l.done).length ?? 0,
    };
  });

  const mediaChart = [
    { name: "Pod", v: data?.podcasts.length ?? 0 },
    { name: "Filmes", v: data?.movies.length ?? 0 },
    { name: "Eps", v: episodes },
    { name: "Livros", v: data?.books.length ?? 0 },
  ];

  // Next birthdays
  const upcomingBdays = (data?.birthdays ?? [])
    .map((b) => {
      const d = parseDateOnly(b.date);
      let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
      if (!isAfter(next, subDays(today, 1))) next = addYears(next, 1);
      return { ...b, next, days: differenceInCalendarDays(next, today) };
    })
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        icon={Sparkles}
        title={`Olá, ${user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "você"} ✿`}
        subtitle={format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Hábitos hoje" value={`${habitsToday}/${totalHabits}`} icon={Activity} tint="primary" />
        <StatCard label="Streak" value={`${streak}d`} icon={Heart} tint="blush" hint="dias consecutivos" />
        <StatCard label="Humor médio" value={avgMood} icon={BookHeart} tint="mint" hint="diário do mês" />
        <StatCard label="Podcasts" value={data?.podcasts.length ?? 0} icon={Mic} tint="sand" hint="ouvidos no mês" />
        <StatCard label="Filmes" value={data?.movies.length ?? 0} icon={Film} tint="blush" />
        <StatCard label="Episódios" value={episodes} icon={Tv} tint="primary" hint="acumulado" />
        <StatCard label="Livros" value={data?.books.length ?? 0} icon={BookOpen} tint="mint" hint="concluídos" />
        <StatCard label="Eventos" value={data?.events.length ?? 0} icon={Calendar} tint="sand" hint="próximos" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="cozy-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg">Hábitos do mês</h3>
              <p className="text-xs text-muted-foreground">{format(today, "MMMM", { locale: ptBR })}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthChart}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Area dataKey="habitos" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="cozy-card p-5">
          <h3 className="font-display text-lg">Consumo</h3>
          <p className="mb-3 text-xs text-muted-foreground">no mês</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mediaChart}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Bar dataKey="v" radius={[8, 8, 0, 0]} fill="var(--chart-2)" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="cozy-card p-5 lg:col-span-2">
          <h3 className="font-display text-lg">Heatmap de hábitos</h3>
          <p className="mb-4 text-xs text-muted-foreground">últimos 120 dias</p>
          <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-2">
            {heat.map((d) => {
              const intensity = Math.min(1, d.count / 4);
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.count}`}
                  className="h-3.5 w-3.5 rounded-[4px]"
                  style={{
                    background: d.count === 0
                      ? "var(--muted)"
                      : `oklch(0.74 ${0.04 + intensity * 0.1} 195 / ${0.35 + intensity * 0.65})`,
                  }}
                />
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="cozy-card p-5">
          <h3 className="mb-1 font-display text-lg">Próximos eventos</h3>
          <p className="mb-3 text-xs text-muted-foreground">na sua agenda</p>
          {data?.events.length ? (
            <ul className="space-y-2">
              {data.events.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-blush/30 text-center">
                    <div className="font-display text-sm leading-none">{format(parseISO(e.date), "d")}</div>
                    <div className="text-[9px] uppercase text-muted-foreground">{format(parseISO(e.date), "MMM", { locale: ptBR })}</div>
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
      </div>

      <div className="mt-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="cozy-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Cake className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg">Próximos aniversários</h3>
          </div>
          {upcomingBdays.length ? (
            <div className="grid gap-3 md:grid-cols-4">
              {upcomingBdays.map((b) => (
                <div key={b.id} className="rounded-2xl border border-border p-4">
                  <div className="text-xs uppercase text-muted-foreground">{b.category}</div>
                  <div className="mt-1 font-display text-lg">{b.name}</div>
                  <div className="mt-1 text-sm text-primary">
                    {b.days === 0 ? "🎂 Hoje!" : `em ${b.days} dia${b.days === 1 ? "" : "s"}`}
                  </div>
                  <div className="text-xs text-muted-foreground">{format(b.next, "d 'de' MMMM", { locale: ptBR })}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Adicione aniversários para receber lembretes.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
