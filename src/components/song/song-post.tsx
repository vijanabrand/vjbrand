import { Link } from "@tanstack/react-router";
import {
  Play, Pause, Heart, MessageCircle, Share2, Download, Loader2, Bookmark,
  MoreHorizontal, ListPlus, ListStart, WifiOff, CheckCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage-urls";
import { usePlayer, type PlayerTrack } from "@/hooks/use-player";
import { resolveAudioUrl, audioLocation } from "@/lib/audio-source";
import { formatCount } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { useFavorites } from "@/hooks/use-favorites";
import { useOffline } from "@/hooks/use-offline";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface FeedSong {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  original_audio_path: string;
  processed_audio_path: string | null;
  play_count: number;
  like_count: number;
  created_at: string;
  singer: { id: string; username: string; full_name: string | null; avatar_url?: string | null } | null;
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function feedTrack(song: FeedSong, cover: string | null = null): PlayerTrack {
  return {
    id: song.id,
    title: song.title,
    singer: song.singer?.full_name ?? song.singer?.username ?? "Unknown artist",
    singerId: song.singer?.id ?? "",
    cover,
    source: {
      original_audio_path: song.original_audio_path,
      processed_audio_path: song.processed_audio_path,
    },
  };
}

export function SongPost({ song, liked, queue }: { song: FeedSong; liked?: boolean; queue?: FeedSong[] }) {
  const { play, toggle, current, isPlaying, addToQueue, playNextInQueue } = usePlayer();
  const { user, requireAuth } = useAuthGate();
  const { isFavorite, toggleFavorite } = useFavorites();
  const offline = useOffline();
  const qc = useQueryClient();
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isLiked, setIsLiked] = useState(!!liked);
  const [likes, setLikes] = useState(song.like_count);

  const isCurrent = current?.id === song.id;
  const singerName = song.singer?.full_name ?? song.singer?.username ?? "Unknown artist";
  const favorited = isFavorite(song.id);
  const savedOffline = offline.isSaved(song.id);

  useEffect(() => setIsLiked(!!liked), [liked]);

  useEffect(() => {
    if (song.cover_url) getSignedUrl("covers", song.cover_url).then(setCoverUrl);
  }, [song.cover_url]);

  useEffect(() => {
    if (song.singer?.avatar_url) getSignedUrl("avatars", song.singer.avatar_url).then(setAvatarUrl);
  }, [song.singer?.avatar_url]);

  async function handlePlay() {
    if (isCurrent) {
      toggle();
      return;
    }
    setBusy(true);
    try {
      const audioUrl = await resolveAudioUrl(song);
      if (!audioUrl) {
        toast.error("Could not load this track");
        return;
      }
      const track: PlayerTrack = { ...feedTrack(song, coverUrl), audioUrl };
      const context = (queue ?? [song]).map((s) => (s.id === song.id ? track : feedTrack(s)));
      play(track, context);
      supabase.rpc("increment_play_count", { _song_id: song.id }).then(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike() {
    if (!requireAuth("Please login to continue.")) return;
    if (!user) return;
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikes((n) => Math.max(0, n + (nextLiked ? 1 : -1)));
    const { error } = nextLiked
      ? await supabase.from("song_likes").insert({ song_id: song.id, user_id: user.id })
      : await supabase.from("song_likes").delete().eq("song_id", song.id).eq("user_id", user.id);
    if (error) {
      setIsLiked(!nextLiked);
      setLikes((n) => Math.max(0, n + (nextLiked ? -1 : 1)));
      toast.error(error.message);
    } else {
      qc.invalidateQueries({ queryKey: ["feed-likes"] });
    }
  }

  async function share() {
    const url = `${window.location.origin}/song/${song.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: song.title, text: `${song.title} by ${singerName}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch {
      /* user cancelled */
    }
  }

  async function download() {
    if (!requireAuth("Please login to continue.")) return;
    if (!user) return;
    setDownloading(true);
    try {
      const { bucket, path } = audioLocation(song);
      const url = await getSignedUrl(bucket, path);
      if (!url) {
        toast.error("Download unavailable");
        return;
      }
      await supabase.from("downloads").insert({ song_id: song.id, user_id: user.id });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${song.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Download started");
    } finally {
      setDownloading(false);
    }
  }

  async function saveForOffline() {
    if (savedOffline) {
      await offline.remove(song.id);
      return;
    }
    const { bucket, path } = audioLocation(song);
    const url = await getSignedUrl(bucket, path);
    if (!url) {
      toast.error("This track can't be saved right now");
      return;
    }
    await offline.save(
      { id: song.id, title: song.title, singer: singerName, singerId: song.singer?.id ?? "", coverUrl },
      url,
    );
  }

  const playing = isCurrent && isPlaying;

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-card transition-shadow hover:shadow-elevated">
      {/* header */}
      <header className="flex items-center gap-3 p-3 sm:p-4">
        <Link to="/artist/$id" params={{ id: song.singer?.id ?? "" }} className="flex min-w-0 flex-1 items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-primary text-sm font-black text-primary-foreground">
              {singerName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{singerName}</div>
            <div className="truncate text-xs text-muted-foreground">{timeAgo(song.created_at)}</div>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={`More options for ${song.title}`}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => addToQueue(feedTrack(song, coverUrl))}>
              <ListPlus className="mr-2 h-4 w-4" /> Add to queue
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => playNextInQueue(feedTrack(song, coverUrl))}>
              <ListStart className="mr-2 h-4 w-4" /> Play next
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void saveForOffline()} disabled={offline.busyId === song.id}>
              {savedOffline ? <CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> : <WifiOff className="mr-2 h-4 w-4" />}
              {savedOffline ? "Remove offline copy" : "Save for offline"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void download()}>
              <Download className="mr-2 h-4 w-4" /> Download
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void share()}>
              <Share2 className="mr-2 h-4 w-4" /> Share
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* cover */}
      <div className="relative aspect-square w-full overflow-hidden bg-secondary sm:aspect-[4/3]">
        {coverUrl ? (
          <img src={coverUrl} alt={`${song.title} cover art`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-gradient-hero" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/10 to-transparent" />
        <button
          onClick={handlePlay}
          disabled={busy}
          aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow transition-transform duration-300 hover:scale-110 active:scale-95">
            {busy ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : playing ? (
              <Pause className="h-7 w-7 fill-current" />
            ) : (
              <Play className="h-7 w-7 fill-current" />
            )}
          </span>
        </button>
        {savedOffline ? (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary backdrop-blur">
            <WifiOff className="h-3 w-3" /> Offline
          </span>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
          <Link
            to="/song/$id"
            params={{ id: song.id }}
            className="pointer-events-auto line-clamp-1 text-lg font-black tracking-tight drop-shadow sm:text-xl"
          >
            {song.title}
          </Link>
        </div>
      </div>

      {/* actions */}
      <div className="flex items-center gap-1 px-2 pt-2 sm:px-3">
        <ActionButton
          onClick={toggleLike}
          label="Like"
          active={isLiked}
          icon={<Heart className={cn("h-5 w-5", isLiked && "fill-current")} />}
          count={likes}
        />
        <Link
          to="/song/$id"
          params={{ id: song.id }}
          hash="comments"
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <MessageCircle className="h-5 w-5" /> <span className="hidden sm:inline">Comment</span>
        </Link>
        <ActionButton onClick={share} label="Share" icon={<Share2 className="h-5 w-5" />} />
        <div className="ml-auto flex items-center">
          <ActionButton
            onClick={() => toggleFavorite(song.id)}
            label={favorited ? "Saved" : "Save"}
            active={favorited}
            icon={<Bookmark className={cn("h-5 w-5", favorited && "fill-current")} />}
          />
          <ActionButton
            onClick={download}
            label="Download"
            icon={downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          />
        </div>
      </div>

      {/* meta */}
      <div className="space-y-1 px-4 pb-4 pt-1">
        <div className="text-xs font-semibold text-muted-foreground">
          {formatCount(song.play_count)} plays · {formatCount(likes)} likes
        </div>
        {song.description ? (
          <p className="line-clamp-2 text-sm text-foreground/90">
            <span className="font-bold">{song.singer?.username ?? singerName}</span> {song.description}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  count,
  active,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {typeof count === "number" && count > 0 ? <span className="tabular-nums">{formatCount(count)}</span> : null}
    </button>
  );
}
