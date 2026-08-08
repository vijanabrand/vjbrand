import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { resolveAudioUrl } from "@/lib/audio-source";

export interface PlayerTrack {
  id: string;
  title: string;
  singer: string;
  singerId: string;
  cover: string | null;
  /** Pre-resolved URL. When absent, `source` is resolved lazily on play. */
  audioUrl?: string;
  /** Storage paths so queued tracks can resolve their URL just in time. */
  source?: { original_audio_path: string; processed_audio_path?: string | null };
  duration?: number | null;
}

type RepeatMode = "off" | "one" | "all";

interface PlayerCtx {
  current: PlayerTrack | null;
  queue: PlayerTrack[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  duration: number;
  volume: number;
  repeat: RepeatMode;
  hasNext: boolean;
  hasPrev: boolean;
  /** Play one track, optionally replacing the queue with its list context. */
  play: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  playQueue: (tracks: PlayerTrack[], startIndex?: number) => void;
  addToQueue: (track: PlayerTrack) => void;
  playNextInQueue: (track: PlayerTrack) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  next: () => void;
  prev: () => void;
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  cycleRepeat: () => void;
  close: () => void;
}

const Ctx = createContext<PlayerCtx | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [current, setCurrent] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.9);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const endedRef = useRef<() => void>(() => {});
  const loadToken = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = new Audio();
    el.preload = "metadata";
    el.volume = 0.9;
    audioRef.current = el;
    const onTime = () => setProgress(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => endedRef.current();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, []);

  const start = useCallback(async (track: PlayerTrack) => {
    const el = audioRef.current;
    if (!el) return;
    const token = ++loadToken.current;
    setCurrent(track);
    setIsLoading(true);
    try {
      const url =
        track.audioUrl ??
        (track.source
          ? await resolveAudioUrl({ id: track.id, ...track.source })
          : null);
      if (token !== loadToken.current) return;
      if (!url) {
        toast.error("Could not load this track");
        setIsPlaying(false);
        return;
      }
      if (el.src !== url) {
        el.src = url;
        setProgress(0);
        setDuration(0);
      }
      await el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } finally {
      if (token === loadToken.current) setIsLoading(false);
    }
  }, []);

  const playIndex = useCallback(
    (list: PlayerTrack[], index: number) => {
      const track = list[index];
      if (!track) return;
      setCurrentIndex(index);
      void start(track);
    },
    [start],
  );

  const play = useCallback<PlayerCtx["play"]>(
    (track, list) => {
      const nextQueue = list && list.length ? list : [track];
      const idx = Math.max(0, nextQueue.findIndex((t) => t.id === track.id));
      setQueue(nextQueue);
      playIndex(nextQueue, idx);
    },
    [playIndex],
  );

  const playQueue = useCallback<PlayerCtx["playQueue"]>(
    (tracks, startIndex = 0) => {
      if (!tracks.length) return;
      setQueue(tracks);
      playIndex(tracks, Math.min(Math.max(startIndex, 0), tracks.length - 1));
    },
    [playIndex],
  );

  const addToQueue = useCallback<PlayerCtx["addToQueue"]>((track) => {
    setQueue((q) => (q.some((t) => t.id === track.id) ? q : [...q, track]));
  }, []);

  const playNextInQueue = useCallback<PlayerCtx["playNextInQueue"]>((track) => {
    setQueue((q) => {
      const filtered = q.filter((t) => t.id !== track.id);
      const at = currentIndex >= 0 ? currentIndex + 1 : filtered.length;
      return [...filtered.slice(0, at), track, ...filtered.slice(at)];
    });
  }, [currentIndex]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((q) => {
      const idx = q.findIndex((t) => t.id === id);
      if (idx < 0) return q;
      setCurrentIndex((ci) => (idx < ci ? ci - 1 : ci));
      return q.filter((t) => t.id !== id);
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue((q) => q.filter((t) => t.id === current?.id));
    setCurrentIndex(current ? 0 : -1);
  }, [current]);

  const next = useCallback(() => {
    if (currentIndex < 0) return;
    const nextIdx = currentIndex + 1;
    if (nextIdx < queue.length) playIndex(queue, nextIdx);
    else if (repeat === "all" && queue.length) playIndex(queue, 0);
  }, [currentIndex, queue, repeat, playIndex]);

  const prev = useCallback(() => {
    const el = audioRef.current;
    if (el && el.currentTime > 4) {
      el.currentTime = 0;
      setProgress(0);
      return;
    }
    if (currentIndex > 0) playIndex(queue, currentIndex - 1);
    else if (el) {
      el.currentTime = 0;
      setProgress(0);
    }
  }, [currentIndex, queue, playIndex]);

  // `ended` handler kept in a ref so the audio element listener stays stable.
  useEffect(() => {
    endedRef.current = () => {
      const el = audioRef.current;
      if (repeat === "one" && el) {
        el.currentTime = 0;
        void el.play();
        return;
      }
      const nextIdx = currentIndex + 1;
      if (currentIndex >= 0 && nextIdx < queue.length) {
        playIndex(queue, nextIdx);
        return;
      }
      if (repeat === "all" && queue.length) {
        playIndex(queue, 0);
        return;
      }
      setIsPlaying(false);
      setProgress(0);
    };
  }, [repeat, currentIndex, queue, playIndex]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || !current) return;
    if (el.paused) el.play().then(() => setIsPlaying(true)).catch(() => {});
    else {
      el.pause();
      setIsPlaying(false);
    }
  }, [current]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
  }, []);

  const seek = useCallback((t: number) => {
    const el = audioRef.current;
    if (el) el.currentTime = t;
    setProgress(t);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  }, []);

  const close = useCallback(() => {
    loadToken.current += 1;
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    setIsPlaying(false);
    setCurrent(null);
    setQueue([]);
    setCurrentIndex(-1);
    setProgress(0);
    setDuration(0);
  }, []);

  const value = useMemo<PlayerCtx>(
    () => ({
      current,
      queue,
      currentIndex,
      isPlaying,
      isLoading,
      progress,
      duration,
      volume,
      repeat,
      hasNext: currentIndex >= 0 && (currentIndex + 1 < queue.length || (repeat === "all" && queue.length > 1)),
      hasPrev: currentIndex > 0,
      play,
      playQueue,
      addToQueue,
      playNextInQueue,
      removeFromQueue,
      clearQueue,
      next,
      prev,
      toggle,
      pause,
      resume,
      seek,
      setVolume,
      cycleRepeat,
      close,
    }),
    [
      current, queue, currentIndex, isPlaying, isLoading, progress, duration, volume, repeat,
      play, playQueue, addToQueue, playNextInQueue, removeFromQueue, clearQueue, next, prev,
      toggle, pause, resume, seek, setVolume, cycleRepeat, close,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer must be used within PlayerProvider");
  return c;
}
