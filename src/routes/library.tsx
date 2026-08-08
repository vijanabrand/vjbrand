import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Heart, WifiOff, Loader2, Play, Pause, Trash2, Music2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useOffline } from "@/hooks/use-offline";
import { usePlayer, type PlayerTrack } from "@/hooks/use-player";
import { SongCard, type SongCardData } from "@/components/song/song-card";
import { getOfflineAudioUrl, formatBytes, type OfflineSongMeta } from "@/lib/offline-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Your library — Vijana Brand" },
      { name: "description", content: "Your saved favorites, liked songs and tracks kept for offline listening." },
      { property: "og:title", content: "Your library — Vijana Brand" },
      { property: "og:description", content: "Favorites, likes and offline songs in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

type Tab = "favorites" | "liked" | "offline";

const SONG_FIELDS =
  "id,title,cover_url,original_audio_path,processed_audio_path,play_count,like_count,singer:profiles!songs_singer_id_profiles_fkey(id,username,full_name)";

function LibraryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("favorites");
  const offline = useOffline();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/library" }, replace: true });
  }, [user, loading, navigate]);

  const favorites = useQuery({
    queryKey: ["favorite-songs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select(`song:songs(${SONG_FIELDS})`)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.song).filter(Boolean) as unknown as SongCardData[];
    },
  });

  const liked = useQuery({
    queryKey: ["liked-songs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("song_likes")
        .select(`song:songs(${SONG_FIELDS})`)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.song).filter(Boolean) as unknown as SongCardData[];
    },
  });

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return null;

  const tabs: { key: Tab; label: string; icon: typeof Heart; count: number }[] = [
    { key: "favorites", label: "Favorites", icon: Bookmark, count: favorites.data?.length ?? 0 },
    { key: "liked", label: "Liked", icon: Heart, count: liked.data?.length ?? 0 },
    { key: "offline", label: "Offline", icon: WifiOff, count: offline.saved.length },
  ];

  const active = tab === "favorites" ? favorites : tab === "liked" ? liked : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">Your library</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything you saved, liked and kept offline.</p>
        </div>
        <Link
          to="/me"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <Music2 className="h-4 w-4" /> My profile
        </Link>
      </header>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-border bg-secondary/50 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              tab === t.key
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.count ? <span className="tabular-nums opacity-80">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {tab === "offline" ? (
        <OfflineList items={offline.saved} onRemove={(id) => void offline.remove(id)} busyId={offline.busyId} />
      ) : active?.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[72px] rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (active?.data?.length ?? 0) > 0 ? (
        <div className="space-y-1">
          {active!.data!.map((s) => (
            <SongCard key={s.id} song={s} queue={active!.data!} variant="row" />
          ))}
        </div>
      ) : (
        <Empty
          title={tab === "favorites" ? "No favorites yet" : "No liked songs yet"}
          body={
            tab === "favorites"
              ? "Tap the bookmark on any song to keep it here."
              : "Tap the heart on a song and it shows up here."
          }
        />
      )}
    </div>
  );
}

function OfflineList({
  items,
  onRemove,
  busyId,
}: {
  items: OfflineSongMeta[];
  onRemove: (id: string) => void;
  busyId: string | null;
}) {
  const { play, current, isPlaying, toggle } = usePlayer();

  async function playOffline(item: OfflineSongMeta) {
    if (current?.id === item.id) {
      toggle();
      return;
    }
    const url = await getOfflineAudioUrl(item.id);
    if (!url) return;
    const track: PlayerTrack = {
      id: item.id,
      title: item.title,
      singer: item.singer,
      singerId: item.singerId,
      cover: null,
      audioUrl: url,
    };
    play(track);
  }

  if (!items.length) {
    return (
      <Empty
        title="Nothing saved offline"
        body="Open a song's menu and choose “Save for offline” to listen without internet."
      />
    );
  }

  const total = items.reduce((n, i) => n + i.size, 0);

  return (
    <div>
      <p className="mb-3 text-xs font-semibold text-muted-foreground">
        {items.length} track{items.length === 1 ? "" : "s"} · {formatBytes(total)} on this device
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const isCurrent = current?.id === item.id;
          return (
            <li key={item.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary/60">
              <button
                onClick={() => void playOffline(item)}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-primary text-primary-foreground"
                aria-label={isCurrent && isPlaying ? `Pause ${item.title}` : `Play ${item.title}`}
              >
                {isCurrent && isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
              </button>
              <Link to="/song/$id" params={{ id: item.id }} className="min-w-0 flex-1">
                <div className={cn("truncate text-sm font-semibold", isCurrent && "text-primary")}>{item.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {item.singer} · {formatBytes(item.size)}
                </div>
              </Link>
              <button
                onClick={() => onRemove(item.id)}
                disabled={busyId === item.id}
                className="rounded-full p-2 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${item.title} from offline`}
              >
                {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
        <Upload className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <Link
        to="/"
        className="mt-5 inline-flex rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
      >
        Explore music
      </Link>
    </div>
  );
}
