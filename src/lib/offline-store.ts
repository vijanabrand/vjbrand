/**
 * Offline song storage backed by IndexedDB.
 * Stores the audio blob plus light metadata so saved songs can be
 * browsed and played with no network connection.
 */

export interface OfflineSongMeta {
  id: string;
  title: string;
  singer: string;
  singerId: string;
  coverUrl: string | null;
  savedAt: number;
  size: number;
}

interface OfflineRecord extends OfflineSongMeta {
  blob: Blob;
  coverBlob?: Blob | null;
}

const DB_NAME = "vijana-offline";
const STORE = "songs";
const VERSION = 1;

function isSupported() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function saveOffline(meta: Omit<OfflineSongMeta, "savedAt" | "size">, audioUrl: string, coverUrl?: string | null) {
  if (!isSupported()) throw new Error("Offline storage is not available on this device");
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error("Could not download this track");
  const blob = await res.blob();
  let coverBlob: Blob | null = null;
  if (coverUrl) {
    try {
      const c = await fetch(coverUrl);
      if (c.ok) coverBlob = await c.blob();
    } catch {
      coverBlob = null;
    }
  }
  const record: OfflineRecord = {
    ...meta,
    savedAt: Date.now(),
    size: blob.size,
    blob,
    coverBlob,
  };
  await tx("readwrite", (s) => s.put(record));
  return record.size;
}

export async function removeOffline(id: string) {
  if (!isSupported()) return;
  await tx("readwrite", (s) => s.delete(id));
}

export async function listOffline(): Promise<OfflineSongMeta[]> {
  if (!isSupported()) return [];
  try {
    const all = (await tx<OfflineRecord[]>("readonly", (s) => s.getAll() as IDBRequest<OfflineRecord[]>)) ?? [];
    return all
      .map(({ blob: _blob, coverBlob: _coverBlob, ...meta }) => meta)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function listOfflineIds(): Promise<string[]> {
  if (!isSupported()) return [];
  try {
    const keys = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys() as IDBRequest<IDBValidKey[]>);
    return (keys ?? []).map(String);
  } catch {
    return [];
  }
}

async function getRecord(id: string): Promise<OfflineRecord | undefined> {
  if (!isSupported()) return undefined;
  try {
    return await tx<OfflineRecord | undefined>("readonly", (s) => s.get(id) as IDBRequest<OfflineRecord | undefined>);
  } catch {
    return undefined;
  }
}

/** Blob object URL for an offline-saved song, or null when not saved. */
export async function getOfflineAudioUrl(id: string): Promise<string | null> {
  const rec = await getRecord(id);
  if (!rec?.blob) return null;
  return URL.createObjectURL(rec.blob);
}

export async function getOfflineCoverUrl(id: string): Promise<string | null> {
  const rec = await getRecord(id);
  if (!rec?.coverBlob) return null;
  return URL.createObjectURL(rec.coverBlob);
}

export function formatBytes(n: number) {
  if (!n) return "0 MB";
  const mb = n / (1024 * 1024);
  return mb < 1 ? `${Math.round(n / 1024)} KB` : `${mb.toFixed(1)} MB`;
}
