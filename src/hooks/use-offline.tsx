import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  listOffline,
  removeOffline,
  saveOffline,
  formatBytes,
  type OfflineSongMeta,
} from "@/lib/offline-store";

interface OfflineCtx {
  saved: OfflineSongMeta[];
  savedIds: Set<string>;
  busyId: string | null;
  isSaved: (id: string) => boolean;
  save: (
    meta: { id: string; title: string; singer: string; singerId: string; coverUrl: string | null },
    audioUrl: string,
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<OfflineCtx | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<OfflineSongMeta[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setSaved(await listOffline());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved]);

  const save = useCallback<OfflineCtx["save"]>(
    async (meta, audioUrl) => {
      setBusyId(meta.id);
      try {
        const size = await saveOffline(
          { id: meta.id, title: meta.title, singer: meta.singer, singerId: meta.singerId, coverUrl: meta.coverUrl },
          audioUrl,
          meta.coverUrl,
        );
        await refresh();
        toast.success(`Saved for offline (${formatBytes(size)})`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save for offline");
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await removeOffline(id);
        await refresh();
        toast.success("Removed from offline");
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const value = useMemo<OfflineCtx>(
    () => ({ saved, savedIds, busyId, isSaved: (id) => savedIds.has(id), save, remove, refresh }),
    [saved, savedIds, busyId, save, remove, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOffline() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useOffline must be used within OfflineProvider");
  return c;
}
