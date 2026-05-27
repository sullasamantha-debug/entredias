import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, EmptyState, StatCard } from "@/components/cozy";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TagInput, TagBadges } from "@/components/TagInput";
import { CoverUpload } from "@/components/CoverUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic, Plus, Heart, Clock, Trash2, Pencil, Search, Star, Headphones, Bookmark, CircleDashed } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/podcasts/")({ component: PodcastsPage });

type Show = {
  id: string; name: string; description: string | null;
  cover_url: string | null; tags: string[] | null; favorite: boolean;
  show_status: string;
};
type Ep = {
  id: string; show_id: string; duration_seconds: number | null;
  listened_date: string | null; title: string; favorite: boolean; status: string;
};

type Filter = "all" | "ongoing" | "ended" | "favorites";

const SHOW_STATUS_OPTS = [
  { value: "ongoing", label: "Em andamento" },
  { value: "ended", label: "Finalizado" },
] as const;

function showStatusBadge(v: string) {
  return v === "ended"
    ? { label: "Encerrado", cls: "bg-muted text-muted-foreground" }
    : { label: "Em andamento", cls: "bg-accent text-foreground/80" };
}

const empty = () => ({
  name: "", description: "", cover_url: "", tags: [] as string[],
  show_status: "ongoing",
});

function fmtDur(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function PodcastsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Show | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"library" | "favorites">("library");
  const [filter, setFilter] = useState<Filter>("all");
  const [form, setForm] = useState(empty());

  useEffect(() => {
    if (!open) return;
    setForm(editing
      ? {
          name: editing.name,
          description: editing.description ?? "",
          cover_url: editing.cover_url ?? "",
          tags: editing.tags ?? [],
          show_status: editing.show_status ?? "ongoing",
        }
      : empty());
  }, [open, editing]);

  const { data } = useQuery({
    enabled: !!user, queryKey: ["podcast_shows", user?.id],
    queryFn: async () => {
      const [shows, eps] = await Promise.all([
        supabase.from("podcast_shows").select("*").order("created_at", { ascending: false }),
        supabase.from("podcast_episodes").select("id,show_id,duration_seconds,listened_date,title,favorite,status").order("listened_date", { ascending: false }),
      ]);
      return { shows: (shows.data ?? []) as unknown as Show[], eps: (eps.data ?? []) as unknown as Ep[] };
    },
  });

  const save = async () => {
    if (!user || !form.name) return;
    const payload = {
      name: form.name,
      description: form.description,
      cover_url: form.cover_url || null,
      tags: form.tags,
      show_status: form.show_status,
      user_id: user.id,
    };
    const { error } = editing
      ? await supabase.from("podcast_shows").update(payload).eq("id", editing.id)
      : await supabase.from("podcast_shows").insert(payload);
    if (error) return toast.error(error.message);
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["podcast_shows"] });
  };

  const remove = async () => {
    if (!confirmId) return;
    await supabase.from("podcast_shows").delete().eq("id", confirmId);
    setConfirmId(null);
    qc.invalidateQueries({ queryKey: ["podcast_shows"] });
  };

  const toggleFav = async (s: Show) => {
    await supabase.from("podcast_shows").update({ favorite: !s.favorite }).eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["podcast_shows"] });
  };

  const shows = data?.shows ?? [];
  const eps = data?.eps ?? [];
  const s = search.toLowerCase();
  const filtered = shows.filter((x) => {
    if (s && !x.name.toLowerCase().includes(s) && !(x.tags ?? []).some((t) => t.toLowerCase().includes(s))) return false;
    if (filter === "all") return true;
    if (filter === "favorites") return x.favorite;
    return x.show_status === filter;
  });

  const listened = eps.filter((e) => e.status === "listened");
  const want = eps.filter((e) => e.status === "want");
  const unheard = eps.filter((e) => e.status === "unheard");
  const listenedSec = listened.reduce((a, e) => a + (e.duration_seconds ?? 0), 0);

  // Most listened podcast
  const countByShow = new Map<string, number>();
  listened.forEach((e) => countByShow.set(e.show_id, (countByShow.get(e.show_id) ?? 0) + 1));
  let topShowName = "—";
  let topCount = 0;
  countByShow.forEach((c, id) => {
    if (c > topCount) { topCount = c; topShowName = shows.find((x) => x.id === id)?.name ?? "—"; }
  });

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "ongoing", label: "Em andamento" },
    { key: "ended", label: "Encerrados" },
    { key: "favorites", label: "Favoritos" },
  ];

  return (
    <div>
      <PageHeader icon={Mic} title="Podcasts" subtitle="Sua biblioteca de escuta."
        action={<Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Novo podcast</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar podcast" : "Novo podcast"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Capa</Label>
              <div className="mt-1">
                <CoverUpload value={form.cover_url || null} onChange={(url) => setForm({ ...form, cover_url: url ?? "" })} />
              </div>
            </div>
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Status do podcast</Label>
              <select value={form.show_status} onChange={(e) => setForm({ ...form, show_status: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {SHOW_STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Se o podcast ainda lança episódios ou já foi encerrado.</p>
            </div>
            <div><Label>Tags</Label><TagInput value={form.tags} onChange={(t) => setForm({ ...form, tags: t })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <Button onClick={save} className="w-full rounded-full">{editing ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Podcasts" value={shows.length} icon={Mic} />
        <StatCard label="Escutados" value={listened.length} icon={Headphones} tint="mint" />
        <StatCard label="Quero ouvir" value={want.length} icon={Bookmark} tint="blush" />
        <StatCard label="Não escutados" value={unheard.length} icon={CircleDashed} tint="sand" />
        <StatCard label="Tempo escutado" value={fmtDur(listenedSec)} icon={Clock} />
        <StatCard label="Mais ouvido" value={topShowName} />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          <button onClick={() => setTab("library")} className={`rounded-full px-4 py-1.5 text-sm transition ${tab === "library" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Biblioteca
          </button>
          <button onClick={() => setTab("favorites")} className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm transition ${tab === "favorites" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Star className="h-3.5 w-3.5" />Favoritos
          </button>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar podcast ou tag…" className="pl-9 rounded-full" />
        </div>
      </div>

      {tab === "library" && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs transition ${filter === f.key ? "bg-foreground text-background" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {tab === "library" ? (
        !filtered.length ? (
          <EmptyState title="Nada por aqui" description="Adicione um podcast — pode ser só para lembrar de ouvir depois." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((x, i) => {
              const my = eps.filter((e) => e.show_id === x.id);
              const myListened = my.filter((e) => e.status === "listened");
              const myWant = my.filter((e) => e.status === "want").length;
              const sec = myListened.reduce((a, e) => a + (e.duration_seconds ?? 0), 0);
              const last = myListened[0];
              const sb = showStatusBadge(x.show_status);
              return (
                <motion.div key={x.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="cozy-card overflow-hidden">
                  <Link to="/podcasts/$showId" params={{ showId: x.id }} className="block">
                    <div className="aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-primary/20 to-blush/30">
                      {x.cover_url ? (
                        <img src={x.cover_url} alt={x.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center">
                          <Mic className="h-12 w-12 text-primary/40" />
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link to="/podcasts/$showId" params={{ showId: x.id }} className="min-w-0 flex-1">
                        <div className="font-display text-lg truncate">{x.name}</div>
                      </Link>
                      <div className="flex gap-0.5">
                        <button onClick={() => toggleFav(x)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent">
                          <Heart className={`h-4 w-4 ${x.favorite ? "fill-[var(--blush)] text-[var(--blush)]" : "text-muted-foreground"}`} />
                        </button>
                        <button onClick={() => { setEditing(x); setOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setConfirmId(x.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${sb.cls}`}>{sb.label}</span>
                      {myWant > 0 && <span className="rounded-full bg-blush/30 px-2 py-0.5 text-[10px] text-foreground/80">{myWant} p/ ouvir</span>}
                    </div>
                    <div className="mt-2"><TagBadges tags={x.tags} /></div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{myListened.length}/{my.length} ep · {fmtDur(sec)}</span>
                      {last && <span className="truncate ml-2">último: {last.title}</span>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      ) : (
        <FavoritesView shows={shows} eps={eps} search={search} />
      )}

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} onConfirm={remove}
        title="Excluir podcast?" description="Todos os episódios vinculados serão removidos." />
    </div>
  );
}

function FavoritesView({ shows, eps, search }: { shows: Show[]; eps: Ep[]; search: string }) {
  const s = search.toLowerCase();
  const favShows = shows.filter((x) => x.favorite && (!s || x.name.toLowerCase().includes(s)));
  const favEps = eps.filter((e) => e.favorite && (!s || e.title.toLowerCase().includes(s)));
  const showById = (id: string) => shows.find((x) => x.id === id);

  if (!favShows.length && !favEps.length) {
    return <EmptyState title="Nenhum favorito ainda" description="Use o ❤️ para marcar podcasts e episódios." />;
  }
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display text-xl">Podcasts favoritos</h2>
        {!favShows.length ? <div className="text-sm text-muted-foreground">Nenhum podcast favorito.</div> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favShows.map((x) => (
              <Link key={x.id} to="/podcasts/$showId" params={{ showId: x.id }} className="cozy-card flex items-center gap-3 p-3 hover:bg-accent/40">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 to-blush/30">
                  {x.cover_url ? <img src={x.cover_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Mic className="h-5 w-5 text-primary/50" /></div>}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{x.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{showStatusBadge(x.show_status).label}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl">Episódios favoritos</h2>
        {!favEps.length ? <div className="text-sm text-muted-foreground">Nenhum episódio favorito.</div> : (
          <div className="space-y-2">
            {favEps.map((e) => {
              const sh = showById(e.show_id);
              return (
                <Link key={e.id} to="/podcasts/$showId" params={{ showId: e.show_id }} className="cozy-card flex items-center gap-3 p-3 hover:bg-accent/40">
                  <Heart className="h-4 w-4 fill-[var(--blush)] text-[var(--blush)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {sh?.name ?? "—"}{e.listened_date ? ` · ${format(new Date(e.listened_date), "dd/MM/yyyy")}` : ""}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
