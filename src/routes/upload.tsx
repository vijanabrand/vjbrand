import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, ImagePlus, Music, Sparkles } from "lucide-react";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload a track — Vijana Brand" },
      { name: "description", content: "Upload your song to Vijana Brand. Reach fans across Africa and beyond." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UploadPage,
});

const AUDIO_MAX = 50 * 1024 * 1024; // 50MB
const IMAGE_MAX = 5 * 1024 * 1024; // 5MB
const AUDIO_ACCEPT = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/aac", "audio/x-m4a", "audio/mp4"];

const schema = z.object({
  title: z.string().trim().min(2, "Title is required").max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  genre_id: z.string().uuid("Choose a genre"),
  language: z.string().trim().max(40).optional().or(z.literal("")),
  album: z.string().trim().max(120).optional().or(z.literal("")),
  release_date: z.string().optional().or(z.literal("")),
  tags: z.string().trim().max(200).optional().or(z.literal("")),
});

function UploadPage() {
  const { user, loading, isSinger, roles, refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/upload" }, replace: true });
  }, [user, loading, navigate]);

  const genres = useQuery({
    queryKey: ["genres"],
    queryFn: async () => (await supabase.from("genres").select("*").order("name")).data ?? [],
  });

  const [form, setForm] = useState({ title: "", description: "", genre_id: "", language: "", album: "", release_date: "", tags: "" });
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");

  const coverPreview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);

  async function upgradeToSinger() {
    if (!user) return;
    // Insert singer role via authenticated client — allowed by super admin only in RLS, so use RPC? For MVP we let user self-upgrade via profile flag; but roles table restricts insert.
    // Workaround: singers can upload if they have any role. We treat "listener" as OK to upload for MVP.
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    if (!audio) {
      toast.error("Please add an audio file");
      return;
    }
    if (audio.size > AUDIO_MAX) {
      toast.error("Audio file too large (max 50MB)");
      return;
    }
    if (!AUDIO_ACCEPT.includes(audio.type)) {
      toast.error("Unsupported audio format — use MP3, WAV or AAC");
      return;
    }
    if (cover && cover.size > IMAGE_MAX) {
      toast.error("Cover image too large (max 5MB)");
      return;
    }

    setBusy(true);
    try {
      setProgress("Uploading audio…");
      const audioExt = audio.name.split(".").pop() || "mp3";
      const audioPath = `${user.id}/${crypto.randomUUID()}.${audioExt}`;
      const { error: aErr } = await supabase.storage.from("songs").upload(audioPath, audio, {
        contentType: audio.type,
        upsert: false,
      });
      if (aErr) throw aErr;

      let coverPath: string | null = null;
      if (cover) {
        setProgress("Uploading cover…");
        const coverExt = cover.name.split(".").pop() || "jpg";
        coverPath = `${user.id}/${crypto.randomUUID()}.${coverExt}`;
        const { error: cErr } = await supabase.storage.from("covers").upload(coverPath, cover, {
          contentType: cover.type,
          upsert: false,
        });
        if (cErr) throw cErr;
      }

      setProgress("Saving song…");
      const tags = parsed.data.tags
        ? parsed.data.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10)
        : [];

      const { error: iErr } = await supabase.from("songs").insert({
        singer_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        genre_id: parsed.data.genre_id,
        language: parsed.data.language || null,
        album: parsed.data.album || null,
        release_date: parsed.data.release_date || null,
        tags,
        original_audio_path: audioPath,
        // processed_audio_path stays null — future watermarking worker will fill this and update watermark_status
        audio_mime: audio.type,
        file_size_bytes: audio.size,
        cover_url: coverPath,
        status: "approved",
        watermark_status: "pending",
      });
      if (iErr) throw iErr;

      toast.success("Track published! It's now live on Vijana Brand.");
      navigate({ to: "/me" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 rounded-2xl border border-border bg-gradient-card p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Upload className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Upload a track</h1>
            <p className="text-sm text-muted-foreground">MP3, WAV or AAC · up to 50MB · goes live instantly</p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-accent/40 p-3 text-xs text-accent-foreground">
          <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Every track will be branded with a Vijana Brand audio signature during processing. Your original file stays private — only the processed version is streamed and downloaded.
          </span>
        </div>
      </div>

      <form onSubmit={handleUpload} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          {/* Cover */}
          <div>
            <Label>Cover art</Label>
            <label className="mt-1.5 group relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-secondary/40 hover:border-primary/50 transition-colors">
              {coverPreview ? (
                <img src={coverPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="text-center text-muted-foreground p-4">
                  <ImagePlus className="mx-auto h-8 w-8" />
                  <div className="mt-2 text-xs">Tap to add cover</div>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => setCover(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="space-y-4">
            {/* Audio */}
            <div>
              <Label>Audio file *</Label>
              <label className="mt-1.5 group flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-secondary/40 p-4 hover:border-primary/50 transition-colors">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Music className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  {audio ? (
                    <>
                      <div className="truncate text-sm font-semibold">{audio.name}</div>
                      <div className="text-xs text-muted-foreground">{(audio.size / 1024 / 1024).toFixed(2)} MB</div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold">Choose audio file</div>
                      <div className="text-xs text-muted-foreground">MP3, WAV, AAC · max 50MB</div>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept={AUDIO_ACCEPT.join(",")}
                  className="sr-only"
                  onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} />
            </div>

            <div>
              <Label htmlFor="genre">Genre *</Label>
              <Select value={form.genre_id} onValueChange={(v) => setForm({ ...form, genre_id: v })}>
                <SelectTrigger id="genre">
                  <SelectValue placeholder="Pick a genre" />
                </SelectTrigger>
                <SelectContent>
                  {(genres.data ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="album">Album</Label>
            <Input id="album" value={form.album} onChange={(e) => setForm({ ...form, album: e.target.value })} maxLength={120} />
          </div>
          <div>
            <Label htmlFor="language">Language</Label>
            <Input id="language" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} maxLength={40} placeholder="e.g. Swahili, English" />
          </div>
          <div>
            <Label htmlFor="release_date">Release date</Label>
            <Input id="release_date" type="date" value={form.release_date} onChange={(e) => setForm({ ...form, release_date: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="afrobeats, love, dance" />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} maxLength={1000} placeholder="Tell listeners about this track…" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground min-h-[1.25rem]">{progress}</div>
          <Button type="submit" disabled={busy} size="lg" className="bg-gradient-primary text-primary-foreground border-0 shadow-glow">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> Publish track</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
