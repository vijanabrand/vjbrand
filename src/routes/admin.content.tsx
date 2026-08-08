import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/content")({
  head: () => ({ meta: [{ title: "Site content — Vijana Brand" }, { name: "robots", content: "noindex" }] }),
  component: AdminContent,
});

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function AdminContent() {
  const { isSuperAdmin } = useAuth();

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Site content settings are available to super admins only.
      </div>
    );
  }

  return (
    <Tabs defaultValue="genres">
      <TabsList className="mb-4 flex w-full flex-wrap justify-start">
        <TabsTrigger value="genres">Genres</TabsTrigger>
        <TabsTrigger value="banners">Banners</TabsTrigger>
        <TabsTrigger value="announcements">Announcements</TabsTrigger>
        <TabsTrigger value="pages">Terms &amp; Privacy</TabsTrigger>
      </TabsList>
      <TabsContent value="genres"><GenresPanel /></TabsContent>
      <TabsContent value="banners"><BannersPanel /></TabsContent>
      <TabsContent value="announcements"><AnnouncementsPanel /></TabsContent>
      <TabsContent value="pages"><PagesPanel /></TabsContent>
    </Tabs>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function GenresPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const genres = useQuery({
    queryKey: ["admin-genres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("genres").select("id,name,slug").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("genres").insert({ name: name.trim(), slug: slugify(name) });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName("");
    toast.success("Genre added");
    qc.invalidateQueries({ queryKey: ["admin-genres"] });
    qc.invalidateQueries({ queryKey: ["genres"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("genres").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Genre removed");
    qc.invalidateQueries({ queryKey: ["admin-genres"] });
    qc.invalidateQueries({ queryKey: ["genres"] });
  }

  return (
    <Panel title="Genres">
      <form onSubmit={add} className="mb-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New genre name" className="max-w-xs" />
        <Button type="submit" disabled={busy} className="border-0 bg-gradient-primary text-primary-foreground">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Add</>}
        </Button>
      </form>
      {genres.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (genres.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No genres yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(genres.data ?? []).map((g) => (
            <span key={g.id} className="flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-sm">
              {g.name}
              <button onClick={() => remove(g.id)} aria-label={`Remove ${g.name}`} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}

function BannersPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", subtitle: "", image_url: "", link_url: "" });
  const [busy, setBusy] = useState(false);

  const banners = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banners").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    setBusy(true);
    const { error } = await supabase.from("banners").insert({
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      image_url: form.image_url.trim() || null,
      link_url: form.link_url.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setForm({ title: "", subtitle: "", image_url: "", link_url: "" });
    toast.success("Banner created");
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
    qc.invalidateQueries({ queryKey: ["home-banners"] });
  }

  async function toggle(id: string, is_active: boolean) {
    const { error } = await supabase.from("banners").update({ is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
    qc.invalidateQueries({ queryKey: ["home-banners"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Banner deleted");
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
    qc.invalidateQueries({ queryKey: ["home-banners"] });
  }

  return (
    <Panel title="Homepage banners">
      <form onSubmit={add} className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Subtitle</Label><Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" /></div>
        <div className="space-y-1.5"><Label>Link URL</Label><Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="/search" /></div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy} className="border-0 bg-gradient-primary text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Add banner</>}
          </Button>
        </div>
      </form>
      {banners.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (banners.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No banners yet.</p>
      ) : (
        <div className="space-y-2">
          {(banners.data ?? []).map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{b.title}</div>
                <div className="truncate text-xs text-muted-foreground">{b.subtitle ?? b.link_url ?? "—"}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Active <Switch checked={b.is_active} onCheckedChange={(v) => toggle(b.id, v)} />
              </div>
              <Button size="sm" variant="outline" onClick={() => remove(b.id)} aria-label="Delete banner">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AnnouncementsPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", body: "" });
  const [busy, setBusy] = useState(false);

  const items = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({ title: form.title.trim(), body: form.body.trim() || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    setForm({ title: "", body: "" });
    toast.success("Announcement published");
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    qc.invalidateQueries({ queryKey: ["home-announcement"] });
  }

  async function toggle(id: string, is_active: boolean) {
    const { error } = await supabase.from("announcements").update({ is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    qc.invalidateQueries({ queryKey: ["home-announcement"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Announcement deleted");
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    qc.invalidateQueries({ queryKey: ["home-announcement"] });
  }

  return (
    <Panel title="Announcements">
      <form onSubmit={add} className="mb-4 space-y-2">
        <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Message</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} /></div>
        <Button type="submit" disabled={busy} className="border-0 bg-gradient-primary text-primary-foreground">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Publish</>}
        </Button>
      </form>
      {items.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (items.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No announcements yet.</p>
      ) : (
        <div className="space-y-2">
          {(items.data ?? []).map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{a.title}</div>
                <div className="truncate text-xs text-muted-foreground">{a.body ?? "—"}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Active <Switch checked={a.is_active} onCheckedChange={(v) => toggle(a.id, v)} />
              </div>
              <Button size="sm" variant="outline" onClick={() => remove(a.id)} aria-label="Delete announcement">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function PagesPanel() {
  const pages = useQuery({
    queryKey: ["admin-pages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_pages").select("*").order("slug");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Panel title="Terms & Privacy">
      {pages.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-4">
          {(pages.data ?? []).map((p) => (
            <PageEditor key={p.id} id={p.id} slug={p.slug} initialTitle={p.title} initialContent={p.content} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function PageEditor({ id, slug, initialTitle, initialContent }: { id: string; slug: string; initialTitle: string; initialContent: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setTitle(initialTitle); setContent(initialContent); }, [initialTitle, initialContent]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("site_pages").update({ title, content }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Page saved");
    qc.invalidateQueries({ queryKey: ["site-page", slug] });
    qc.invalidateQueries({ queryKey: ["admin-pages"] });
  }

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">/{slug}</div>
      <div className="space-y-2">
        <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Content</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} /></div>
        <Button onClick={save} disabled={busy} className="border-0 bg-gradient-primary text-primary-foreground">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save</>}
        </Button>
      </div>
    </div>
  );
}
