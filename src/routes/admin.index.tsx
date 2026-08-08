import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Music2,
  Users,
  Mic2,
  CheckCircle2,
  EyeOff,
  Download,
  HardDrive,
  Heart,
  PlayCircle,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { formatBytes, formatCount, timeAgo } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [totalSongs, hidden, published, users, singerRoles, downloads, likes, comments, agg] = await Promise.all([
        supabase.from("songs").select("*", { count: "exact", head: true }),
        supabase.from("songs").select("*", { count: "exact", head: true }).eq("is_hidden", true),
        supabase.from("songs").select("*", { count: "exact", head: true }).eq("is_hidden", false),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "singer"),
        supabase.from("downloads").select("*", { count: "exact", head: true }),
        supabase.from("song_likes").select("*", { count: "exact", head: true }),
        supabase.from("comments").select("*", { count: "exact", head: true }),
        supabase.from("songs").select("file_size_bytes,play_count"),
      ]);
      const rows = agg.data ?? [];
      return {
        totalSongs: totalSongs.count ?? 0,
        hidden: hidden.count ?? 0,
        published: published.count ?? 0,
        users: users.count ?? 0,
        singers: singerRoles.count ?? 0,
        downloads: downloads.count ?? 0,
        likes: likes.count ?? 0,
        comments: comments.count ?? 0,
        totalBytes: rows.reduce((a, r) => a + (r.file_size_bytes ?? 0), 0),
        plays: rows.reduce((a, r) => a + (r.play_count ?? 0), 0),
      };
    },
  });

  const topSongs = useQuery({
    queryKey: ["admin-top-songs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("songs")
        .select("id,title,play_count,like_count")
        .order("play_count", { ascending: false })
        .limit(7);
      return data ?? [];
    },
  });

  const recent = useQuery({
    queryKey: ["admin-recent-activity"],
    queryFn: async () => {
      const [songs, users, comments] = await Promise.all([
        supabase.from("songs").select("id,title,created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("profiles").select("id,username,created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("comments").select("id,content,song_id,created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      const items: { key: string; text: string; at: string; to?: string; id?: string }[] = [];
      (songs.data ?? []).forEach((s) =>
        items.push({ key: `s${s.id}`, text: `New song “${s.title}”`, at: s.created_at, to: "song", id: s.id }),
      );
      (users.data ?? []).forEach((u) =>
        items.push({ key: `u${u.id}`, text: `New member @${u.username}`, at: u.created_at, to: "artist", id: u.id }),
      );
      (comments.data ?? []).forEach((c) =>
        items.push({
          key: `c${c.id}`,
          text: `New comment: ${c.content.slice(0, 60)}`,
          at: c.created_at,
          to: "song",
          id: c.song_id,
        }),
      );
      return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 12);
    },
  });

  const cards = [
    { label: "Total users", value: formatCount(stats.data?.users), icon: Users },
    { label: "Singers", value: formatCount(stats.data?.singers), icon: Mic2 },
    { label: "Total songs", value: formatCount(stats.data?.totalSongs), icon: Music2 },
    { label: "Visible songs", value: formatCount(stats.data?.published), icon: CheckCircle2 },
    { label: "Hidden songs", value: formatCount(stats.data?.hidden), icon: EyeOff },
    { label: "Total plays", value: formatCount(stats.data?.plays), icon: PlayCircle },
    { label: "Total likes", value: formatCount(stats.data?.likes), icon: Heart },
    { label: "Comments", value: formatCount(stats.data?.comments), icon: MessageCircle },
    { label: "Downloads", value: formatCount(stats.data?.downloads), icon: Download },
    { label: "Storage used", value: formatBytes(stats.data?.totalBytes), icon: HardDrive },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-gradient-card p-4">
            <div className="inline-grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
              <c.icon className="h-4 w-4" />
            </div>
            <div className="mt-3 text-2xl font-black tracking-tight">
              {stats.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (c.value ?? "—")}
            </div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Most played songs</h2>
          {topSongs.isLoading ? (
            <div className="grid h-64 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (topSongs.data ?? []).length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No songs uploaded yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSongs.data ?? []} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="title"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 10)}…` : v)}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="play_count" name="Plays" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="like_count" name="Likes" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Recent activity</h2>
          {recent.isLoading ? (
            <div className="grid h-64 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (recent.data ?? []).length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Nothing has happened yet.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {(recent.data ?? []).map((a) => (
                <li key={a.key} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-2.5 text-sm">
                  {a.to === "song" && a.id ? (
                    <Link to="/song/$id" params={{ id: a.id }} className="min-w-0 flex-1 truncate hover:text-primary">
                      {a.text}
                    </Link>
                  ) : a.to === "artist" && a.id ? (
                    <Link to="/artist/$id" params={{ id: a.id }} className="min-w-0 flex-1 truncate hover:text-primary">
                      {a.text}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate">{a.text}</span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
