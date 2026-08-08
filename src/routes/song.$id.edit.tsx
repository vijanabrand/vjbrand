import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, ImagePlus } from "lucide-react";
import { getSignedUrl, invalidateSignedUrl } from "@/lib/storage-urls";

export const Route = createFileRoute("/song/$id/edit")({
  head: () => ({ meta: [{ title: "Edit song — Vijana Brand" }, { name: "robots", content: "noindex" }] }),
  component: EditSongPage,
});

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  genre_id: z.string().uuid(),
  language: z.string().trim().max(40).optional().or(z.literal("")),
  album: z.string().trim().max(120).optional().or(z.literal("")),
  release_date: z.string().optional().or(z.literal("")),
  tags: z.string().trim().max(200).optional().or(z.literal("")),
});

function EditSongPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const song = useQuery({
    queryKey: ["edit-song", id],
    queryFn: async () => (await supabase.from("songs").select("*").eq("id", id).maybeSingle()).data,
  });

  const genres = useQuery({
    queryKey: ["genres"],
    queryFn: async () => (await supabase.from("genres").select("*").order("name")).data ?? [],
  });

  const [form, setForm] = useState({ title: "", description: "", genre_id: "", language: "", album: "", release_date: "", tags: "" });
  const [cover, setCover] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: `/song/${id}/edit` }, replace: true });
  }, [loading, user, navigate, id]);

  useEffect(() => {
    if (!song.data) return;
    setForm({
      title: song.data.title ?? "",
      description: song.data.description ?? "",
      genre_id: song.data.genre_id ?? "",
      language: song.data.language ?? "",
      album: song.data.album ?? "",
      release_date: song.data.release_date ?? "",
      tags: (song.data.tags ?? []).join(", "),
    });
    if (song.data.cover_url) void getSignedUrl("covers", song.data.cover_url).then(setCoverUrl);
  }, [song.data]);

  if (loading || song.isLoading) return <div className="py-16 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>;
  if (!song.data) return <div className="py-16 text-center text-muted-foreground">Song not found.</div>;
  if (user && song.data.singer_id !== user.id) return <div className="py-16 text-center text-muted-foreground">You can only edit your own tracks.</div>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Check the form");
    setBusy(true);
    try {
      let cover_url = song.data!.cover_url;
      if (cover) {
        if (cover.size > 5 * 1024 * 1024) throw new Error("Cover too large (5MB max)");
        const ext = cover.name.split(".").pop() ?? "jpg";
        const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("covers").upload(path, cover, { contentType: cover.type });
        if (error) throw error;
        if (cover_url) invalidateSignedUrl("covers", cover_url);
        cover_url = path;
      }
      const tags = parsed.data.tags ? parsed.data.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10) : [];
      const { error } = await supabase.from("songs").update({
        title: parsed.data.title,
        description: parsed.data.description || null,
        genre_id: parsed.data.genre_id,
        language: parsed.data.language || null,
        album: parsed.data.album || null,
        release_date: parsed.data.release_date || null,
        tags,
        cover_url,
      }).eq("id", id);
      if (error) throw error;
      toast.success("Changes saved");
      navigate({ to: "/song/$id", params: { id } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  const preview = cover ? URL.createObjectURL(cover) : coverUrl;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-black mb-6">Edit track</h1>
      <form onSubmit={save} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <div>
            <Label>Cover art</Label>
            <label className="mt-1.5 group relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-secondary/40 hover:border-primary/50 transition-colors">
              {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : (
                <div className="text-center text-muted-foreground p-4"><ImagePlus className="mx-auto h-8 w-8" /><div className="mt-2 text-xs">Change cover</div></div>
              )}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} /></div>
            <div>
              <Label>Genre *</Label>
              <Select value={form.genre_id} onValueChange={(v) => setForm({ ...form, genre_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a genre" /></SelectTrigger>
                <SelectContent>{(genres.data ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Album</Label><Input value={form.album} onChange={(e) => setForm({ ...form, album: e.target.value })} /></div>
          <div><Label>Language</Label><Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} /></div>
          <div><Label>Release date</Label><Input type="date" value={form.release_date} onChange={(e) => setForm({ ...form, release_date: e.target.value })} /></div>
          <div><Label>Tags</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="afrobeats, love" /></div>
        </div>
        <div><Label>Description</Label><Textarea rows={4} maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/song/$id", params: { id } })}>Cancel</Button>
          <Button type="submit" disabled={busy} className="bg-gradient-primary text-primary-foreground border-0"><Save className="h-4 w-4" />{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      </form>
    </div>
  );
}
