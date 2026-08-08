import { getSignedUrl } from "@/lib/storage-urls";
import { getOfflineAudioUrl } from "@/lib/offline-store";

export interface PlayableSong {
  id: string;
  original_audio_path: string;
  processed_audio_path?: string | null;
}

export function audioLocation(song: PlayableSong) {
  const bucket = song.processed_audio_path ? "processed_songs" : "songs";
  const path = song.processed_audio_path ?? song.original_audio_path;
  return { bucket, path };
}

/** Offline copy first (instant + works with no network), signed URL otherwise. */
export async function resolveAudioUrl(song: PlayableSong): Promise<string | null> {
  const offline = await getOfflineAudioUrl(song.id);
  if (offline) return offline;
  const { bucket, path } = audioLocation(song);
  return getSignedUrl(bucket, path);
}
