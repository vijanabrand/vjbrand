import { supabase } from "@/integrations/supabase/client";

/** Signed URL for a private bucket path. Caches per session in memory. */
const cache = new Map<string, { url: string; exp: number }>();

export async function getSignedUrl(
  bucket: string,
  path: string | null | undefined,
  expiresIn = 60 * 60,
): Promise<string | null> {
  if (!path) return null;
  const key = `${bucket}:${path}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.exp > now + 30_000) return cached.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  cache.set(key, { url: data.signedUrl, exp: now + expiresIn * 1000 });
  return data.signedUrl;
}

export function invalidateSignedUrl(bucket: string, path: string) {
  cache.delete(`${bucket}:${path}`);
}
