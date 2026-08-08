import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { getSignedUrl } from "@/lib/storage-urls";
import { usePlayer } from "@/hooks/use-player";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Button } from "@/components/ui/button";
import { Play, Pause, Heart, Download, Share2, MessageCircle, Send, Trash2, Music2, Bookmark, Flag, Reply } from "lucide-react";
import { formatCount, formatDuration, timeAgo } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/song/$id")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("songs")
      .select(
        "id,title,description,cover_url,original_audio_path,processed_audio_path,play_count,like_count,download_count,duration_seconds,language,album,release_date,tags,created_at,singer:profiles!songs_singer_id_profiles_fkey(id,username,full_name,avatar_url),genre:genres(name,slug)",
      )
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — ${loaderData.singer?.full_name ?? loaderData.singer?.username ?? "Vijana Brand"}` },
          { name: "description", content: (loaderData.description ?? `Listen to ${loaderData.title} on Vijana Brand.`).slice(0, 160) },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: (loaderData.description ?? "").slice(0, 160) || "Listen on Vijana Brand" },
          { property: "og:type", content: "music.song" },
        ]
      : [{ title: "Song — Vijana Brand" }],
  }),
  component: SongDetail,
});

function SongDetail() {
  const song = Route.useLoaderData();
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const { play, current, isPlaying, toggle } = usePlayer();
  const qc = useQueryClient();
  const cover = useSignedUrl("covers", song.cover_url);
  const isCurrent = current?.id === song.id;

  const like = useQuery({
    queryKey: ["like", song.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("song_likes").select("song_id").eq("song_id", song.id).eq("user_id", user.id).maybeSingle();
      return !!data;
    },
  });

  const fav = useQuery({
    queryKey: ["fav", song.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("favorites").select("song_id").eq("song_id", song.id).eq("user_id", user.id).maybeSingle();
      return !!data;
    },
  });

  const comments = useQuery({
    queryKey: ["comments", song.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("id,content,created_at,user_id,parent_id,user:profiles!comments_user_id_profiles_fkey(username,full_name,avatar_url)")
        .eq("song_id", song.id)
        .order("created_at", { ascending: true })
        .limit(200);
      return (data ?? []) as CommentRow[];
    },
  });

  async function handlePlay() {
    if (isCurrent) {
      toggle();
      return;
    }
    const bucket = song.processed_audio_path ? "processed_songs" : "songs";
    const path = song.processed_audio_path ?? song.original_audio_path;
    const url = await getSignedUrl(bucket, path);
    if (!url) {
      toast.error("Couldn't load audio");
      return;
    }
    play({
      id: song.id,
      title: song.title,
      singer: song.singer?.full_name ?? song.singer?.username ?? "Unknown",
      singerId: song.singer?.id ?? "",
      cover,
      audioUrl: url,
      duration: song.duration_seconds,
    });
    void supabase.rpc("increment_play_count", { _song_id: song.id });
  }

  async function toggleLike() {
    if (!requireAuth()) return;
    if (!user) return;
    if (like.data) {
      await supabase.from("song_likes").delete().eq("song_id", song.id).eq("user_id", user.id);
    } else {
      await supabase.from("song_likes").insert({ song_id: song.id, user_id: user.id });
    }
    qc.invalidateQueries({ queryKey: ["like", song.id] });
  }

  async function toggleFav() {
    if (!requireAuth()) return;
    if (!user) return;
    if (fav.data) {
      await supabase.from("favorites").delete().eq("song_id", song.id).eq("user_id", user.id);
      toast.success("Removed from favorites");
    } else {
      await supabase.from("favorites").insert({ song_id: song.id, user_id: user.id });
      toast.success("Saved to favorites");
    }
    qc.invalidateQueries({ queryKey: ["fav", song.id] });
    qc.invalidateQueries({ queryKey: ["favorites"] });
  }

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareData = { title: song.title, text: `Listen to ${song.title} on Vijana Brand`, url };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try { await (navigator as Navigator).share(shareData); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  async function download() {
    if (!requireAuth()) return;
    if (!user) return;
    const bucket = song.processed_audio_path ? "processed_songs" : "songs";
    const path = song.processed_audio_path ?? song.original_audio_path;
    const url = await getSignedUrl(bucket, path);
    if (!url) return;
    await supabase.from("downloads").insert({ song_id: song.id, user_id: user.id });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${song.title}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Downloading…");
  }

  async function report() {
    if (!requireAuth()) return;
    if (!user) return;
    const reason = prompt("Why are you reporting this song?");
    if (!reason) return;
    const { error } = await supabase.from("reports").insert({ song_id: song.id, reporter_id: user.id, reason });
    if (error) toast.error(error.message); else toast.success("Report submitted");
  }

  // build comment tree
  const roots = (comments.data ?? []).filter((c) => !c.parent_id);
  const childrenOf = (id: string) => (comments.data ?? []).filter((c) => c.parent_id === id);

  return (
    <div className="relative">
      <div className="relative overflow-hidden">
        {cover ? (
          <div className="absolute inset-0" style={{ backgroundImage: `url(${cover})`, backgroundSize: "cover", filter: "blur(60px)", opacity: 0.4 }} />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        <div className="relative mx-auto max-w-5xl px-4 py-8 md:py-14">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-end">
            <div className="mx-auto md:mx-0 aspect-square w-56 md:w-64 overflow-hidden rounded-2xl bg-secondary shadow-elevated">
              {cover ? (
                <img src={cover} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-primary grid place-items-center">
                  <Music2 className="h-16 w-16 text-primary-foreground/80" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 text-center md:text-left">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Song</div>
              <h1 className="mt-1 text-3xl md:text-5xl font-black tracking-tight leading-tight">{song.title}</h1>
              <div className="mt-2 text-muted-foreground">
                {song.singer ? (
                  <Link to="/artist/$id" params={{ id: song.singer.id }} className="font-semibold text-foreground hover:text-primary">
                    {song.singer.full_name ?? song.singer.username}
                  </Link>
                ) : "Unknown artist"}
                {song.genre ? <> · <span>{song.genre.name}</span></> : null}
                {song.duration_seconds ? <> · <span>{formatDuration(song.duration_seconds)}</span></> : null}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-2">
                <Button size="lg" onClick={handlePlay} className="bg-gradient-primary text-primary-foreground border-0 shadow-glow rounded-full px-6">
                  {isCurrent && isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
                  {isCurrent && isPlaying ? "Pause" : "Play"}
                </Button>
                <Button size="lg" variant="outline" onClick={toggleLike} className="rounded-full" aria-label="Like">
                  <Heart className={like.data ? "h-5 w-5 fill-primary text-primary" : "h-5 w-5"} />
                  {formatCount(song.like_count)}
                </Button>
                <Button size="lg" variant="outline" onClick={toggleFav} className="rounded-full" aria-label="Save">
                  <Bookmark className={fav.data ? "h-5 w-5 fill-primary text-primary" : "h-5 w-5"} />
                </Button>
                <Button size="lg" variant="outline" onClick={download} className="rounded-full" aria-label="Download">
                  <Download className="h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" onClick={share} className="rounded-full" aria-label="Share">
                  <Share2 className="h-5 w-5" />
                </Button>
                <Button size="lg" variant="ghost" onClick={report} className="rounded-full text-muted-foreground" aria-label="Report">
                  <Flag className="h-5 w-5" />
                </Button>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {formatCount(song.play_count)} plays · {formatCount(song.download_count)} downloads
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 md:py-10 space-y-8">
        {song.description ? (
          <section>
            <h2 className="text-lg font-bold mb-2">About</h2>
            <p className="whitespace-pre-wrap text-muted-foreground">{song.description}</p>
          </section>
        ) : null}

        {song.tags && song.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {song.tags.map((t: string) => (
              <span key={t} className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium">#{t}</span>
            ))}
          </div>
        ) : null}

        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <MessageCircle className="h-5 w-5" /> Comments ({comments.data?.length ?? 0})
          </h2>
          <CommentForm songId={song.id} parentId={null} onPosted={() => qc.invalidateQueries({ queryKey: ["comments", song.id] })} />
          <div className="mt-4 space-y-3">
            {roots.map((c) => (
              <CommentThread key={c.id} c={c} songId={song.id} children={childrenOf(c.id)} onChanged={() => qc.invalidateQueries({ queryKey: ["comments", song.id] })} />
            ))}
            {comments.data?.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">Be the first to comment.</div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function CommentForm({ songId, parentId, onPosted, autoFocus }: { songId: string; parentId: string | null; onPosted: () => void; autoFocus?: boolean }) {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!requireAuth()) return;
    if (!user) return;
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("comments").insert({ song_id: songId, user_id: user.id, content: text.trim(), parent_id: parentId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setText("");
    onPosted();
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={parentId ? "Write a reply…" : "Add a comment…"}
        maxLength={1000}
        className="flex-1 rounded-full border border-border bg-input px-4 py-2 text-sm outline-none focus:border-ring"
      />
      <Button type="submit" disabled={busy || !text.trim()} className="rounded-full bg-gradient-primary text-primary-foreground border-0" aria-label="Send">
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  user: { username: string; full_name: string | null; avatar_url: string | null } | null;
}

function CommentThread({ c, songId, children, onChanged }: { c: CommentRow; songId: string; children: CommentRow[]; onChanged: () => void }) {
  const [replying, setReplying] = useState(false);
  return (
    <div>
      <CommentItem c={c} onDeleted={onChanged} onReply={() => setReplying((v) => !v)} />
      {replying ? (
        <div className="ml-12 mt-2">
          <CommentForm songId={songId} parentId={c.id} autoFocus onPosted={() => { setReplying(false); onChanged(); }} />
        </div>
      ) : null}
      {children.length > 0 ? (
        <div className="ml-12 mt-2 space-y-2">
          {children.map((r) => <CommentItem key={r.id} c={r} onDeleted={onChanged} />)}
        </div>
      ) : null}
    </div>
  );
}

function CommentItem({ c, onDeleted, onReply }: { c: CommentRow; onDeleted: () => void; onReply?: () => void }) {
  const { user, isAdmin } = useAuth();
  const { requireAuth } = useAuthGate();
  const canDelete = user && (user.id === c.user_id || isAdmin);
  const avatar = useSignedUrl("avatars", c.user?.avatar_url ?? null);
  async function del() {
    if (!confirm("Delete this comment?")) return;
    await supabase.from("comments").delete().eq("id", c.id);
    onDeleted();
  }
  async function report() {
    if (!requireAuth()) return;
    if (!user) return;
    const reason = prompt("Report reason:");
    if (!reason) return;
    const { error } = await supabase.from("reports").insert({ comment_id: c.id, reporter_id: user.id, reason });
    if (error) toast.error(error.message); else toast.success("Report submitted");
  }
  return (
    <div className="flex gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-primary grid place-items-center text-sm font-bold text-primary-foreground">
        {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (c.user?.username ?? "?").slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold truncate">{c.user?.full_name ?? c.user?.username ?? "User"}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
        </div>
        <div className="mt-1 whitespace-pre-wrap text-sm">{c.content}</div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          {onReply ? (
            <button onClick={onReply} className="inline-flex items-center gap-1 hover:text-foreground"><Reply className="h-3 w-3" /> Reply</button>
          ) : null}
          <button onClick={report} className="inline-flex items-center gap-1 hover:text-destructive"><Flag className="h-3 w-3" /> Report</button>
        </div>
      </div>
      {canDelete ? (
        <button onClick={del} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Delete comment">
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
