import { Play, Pause, Volume2, X, SkipBack, SkipForward, ListMusic, Repeat, Repeat1, Trash2, Loader2 } from "lucide-react";
import { usePlayer } from "@/hooks/use-player";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatDuration } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function FloatingPlayer() {
  const {
    current, isPlaying, isLoading, toggle, progress, duration, seek, volume, setVolume, close,
    queue, currentIndex, next, prev, hasNext, hasPrev, playQueue, removeFromQueue, clearQueue,
    repeat, cycleRepeat,
  } = usePlayer();
  if (!current) return null;

  const upNext = queue.length > 1;

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] md:bottom-4 z-50 px-2 md:px-4">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border glass shadow-elevated">
        <div className="h-0.5 bg-secondary">
          <div
            className="h-full bg-gradient-primary transition-[width] duration-150"
            style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }}
          />
        </div>
        <div className="flex items-center gap-2 p-2.5 sm:gap-3">
          <Link to="/song/$id" params={{ id: current.id }} className="flex min-w-0 flex-1 items-center gap-3">
            {current.cover ? (
              <img src={current.cover} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="h-12 w-12 shrink-0 rounded-lg bg-gradient-primary" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{current.title}</div>
              <div className="truncate text-xs text-muted-foreground">{current.singer}</div>
            </div>
          </Link>

          <Button
            size="icon"
            variant="ghost"
            onClick={prev}
            disabled={!hasPrev && progress < 4}
            className="hidden h-9 w-9 shrink-0 sm:inline-flex"
            aria-label="Previous track"
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            onClick={toggle}
            className="h-10 w-10 shrink-0 rounded-full bg-gradient-primary text-primary-foreground border-0 shadow-glow"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={next}
            disabled={!hasNext}
            className="h-9 w-9 shrink-0"
            aria-label="Next track"
          >
            <SkipForward className="h-4 w-4" />
          </Button>

          <div className="hidden md:flex items-center gap-2 w-56">
            <span className="text-xs tabular-nums text-muted-foreground">{formatDuration(progress)}</span>
            <Slider value={[progress]} max={duration || 1} step={1} onValueChange={(v) => seek(v[0] ?? 0)} className="flex-1" />
            <span className="text-xs tabular-nums text-muted-foreground">{formatDuration(duration)}</span>
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={cycleRepeat}
            className={cn("hidden h-9 w-9 shrink-0 lg:inline-flex", repeat !== "off" && "text-primary")}
            aria-label={`Repeat: ${repeat}`}
          >
            {repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
          </Button>

          <div className="hidden xl:flex items-center gap-2 w-28">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider value={[volume * 100]} max={100} step={1} onValueChange={(v) => setVolume((v[0] ?? 0) / 100)} className="flex-1" />
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="relative h-9 w-9 shrink-0" aria-label="Open queue">
                <ListMusic className="h-4 w-4" />
                {upNext ? (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {queue.length}
                  </span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Play queue</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">{queue.length} track{queue.length === 1 ? "" : "s"}</span>
                {upNext ? (
                  <button onClick={clearQueue} className="text-xs font-semibold text-muted-foreground hover:text-destructive">
                    Clear queue
                  </button>
                ) : null}
              </div>
              <ul className="mt-2 max-h-[70vh] space-y-1 overflow-y-auto pr-1">
                {queue.map((t, i) => (
                  <li
                    key={t.id}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl p-2",
                      i === currentIndex ? "bg-accent" : "hover:bg-secondary",
                    )}
                  >
                    <button onClick={() => playQueue(queue, i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      {t.cover ? (
                        <img src={t.cover} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-primary" />
                      )}
                      <span className="min-w-0">
                        <span className={cn("block truncate text-sm font-semibold", i === currentIndex && "text-primary")}>
                          {t.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{t.singer}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => removeFromQueue(t.id)}
                      className="rounded-full p-2 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      aria-label={`Remove ${t.title} from queue`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>

          <Button size="icon" variant="ghost" onClick={close} className="h-9 w-9 shrink-0" aria-label="Close player">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile progress row */}
        <div className="flex items-center gap-2 px-3 pb-2 md:hidden">
          <span className="text-[10px] tabular-nums text-muted-foreground">{formatDuration(progress)}</span>
          <Slider value={[progress]} max={duration || 1} step={1} onValueChange={(v) => seek(v[0] ?? 0)} className="flex-1" />
          <span className="text-[10px] tabular-nums text-muted-foreground">{formatDuration(duration)}</span>
        </div>
      </div>
    </div>
  );
}
