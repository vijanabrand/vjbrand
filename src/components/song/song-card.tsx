import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage-urls";
import { resolveAudioUrl } from "@/lib/audio-source";

import { usePlayer, type PlayerTrack } from "@/hooks/use-player";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SongCardData {
  id: string;
  title: string;
  cover_url: string | null;
  original_audio_path: string;
  processed_audio_path: string | null;
  play_count: number;
  like_count: number;
  singer: { id: string; username: string; full_name: string | null } | null;
}

export function SongCard({ song, queue, variant = "grid" }: {
  song: SongCardData;
  queue?: SongCardData[];
  variant?: "grid" | "row";
}) {
  const { play, current, isPlaying } = usePlayer();
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const isCurrent = current?.id === song.id;

  useEffect(() => {
    if (song.cover_url) getSignedUrl("covers", song.cover_url).then(setCoverUrl);
  }, [song.cover_url]);

  async function handlePlay(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Offline copy first, then processed (public), then original (owner signed).
    const audioUrl = await resolveAudioUrl(song);
    if (!audioUrl) return;
    const toTrack = (s: SongCardData, cover: string | null = null): PlayerTrack => ({
      id: s.id,
      title: s.title,
      singer: s.singer?.full_name ?? s.singer?.username ?? "Unknown",
      singerId: s.singer?.id ?? "",
      cover,
      source: { original_audio_path: s.original_audio_path, processed_audio_path: s.processed_audio_path },
    });
    const track: PlayerTrack = { ...toTrack(song, coverUrl), audioUrl };
    const context = (queue ?? [song]).map((s) => (s.id === song.id ? track : toTrack(s)));
    play(track, context);
  }



  if (variant === "row") {
    return (
      <Link
        to="/song/$id"
        params={{ id: song.id }}
        className="group flex items-center gap-3 rounded-xl p-2 hover:bg-secondary/60"
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-full w-full bg-gradient-primary" />
          )}
          <button
            onClick={handlePlay}
            className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Play"
          >
            <Play className="h-5 w-5 fill-primary-foreground text-primary-foreground" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-sm font-semibold", isCurrent && "text-primary")}>{song.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {song.singer?.full_name ?? song.singer?.username ?? "Unknown"}
          </div>
        </div>
        <div className="hidden sm:block text-xs tabular-nums text-muted-foreground">
          {formatCount(song.play_count)} plays
        </div>
      </Link>
    );
  }

  return (
    <Link to="/song/$id" params={{ id: song.id }} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-card shadow-card">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-gradient-hero" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/0 to-transparent" />
        <button
          onClick={handlePlay}
          className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-gradient-primary text-primary-foreground opacity-0 shadow-glow transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-110"
          aria-label={`Play ${song.title}`}
        >
          {isCurrent && isPlaying ? (
            <span className="flex items-end gap-0.5 h-4">
              <span className="w-0.5 bg-current animate-pulse" style={{ height: "60%" }} />
              <span className="w-0.5 bg-current animate-pulse" style={{ height: "100%", animationDelay: "0.15s" }} />
              <span className="w-0.5 bg-current animate-pulse" style={{ height: "80%", animationDelay: "0.3s" }} />
            </span>
          ) : (
            <Play className="h-5 w-5 fill-current" />
          )}
        </button>
      </div>
      <div className="mt-3 px-1">
        <div className={cn("truncate text-sm font-semibold", isCurrent && "text-primary")}>{song.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {song.singer?.full_name ?? song.singer?.username ?? "Unknown"}
        </div>
      </div>
    </Link>
  );
}
