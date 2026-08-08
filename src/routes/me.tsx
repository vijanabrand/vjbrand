import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SongCard, type SongCardData } from "@/components/song/song-card";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Music2, Upload, Heart, ListMusic, EyeOff, CheckCircle2, XCircle, Edit2, Trash2, MessageCircle, Download as DownloadIcon, Play } from "lucide-react";
import { formatCount, timeAgo } from "@/lib/format";
import { toast } from "sonner";
import { invalidateSignedUrl } from "@/lib/storage-urls";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [{ title: "My library — Vijana Brand" }, { name: "robots", content: "noindex" }],
  }),
  component: MePage,
});

function MePage() {
  const { user, profile, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/me" }, replace: true });
  }, [loading, user, navigate]);

  const avatar = useSignedUrl("avatars", profile?.avatar_url ?? null);
  const [profileOpen, setProfileOpen] = useState(false);

  const mySongs = useQuery({
    queryKey: ["my-songs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("songs")
        .select("id,title,cover_url,original_audio_path,processed_audio_path,play_count,like_count,download_count,status,rejection_reason,is_hidden,created_at")
        .eq("singer_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as MySong[];
    },
  });

  const commentCounts = useQuery({
    queryKey: ["my-comment-counts", user?.id],
    enabled: !!user && !!mySongs.data?.length,
    queryFn: async () => {
      const ids = (mySongs.data ?? []).map((s) => s.id);
      if (!ids.length) return new Map<string, number>();
      const { data } = await supabase.from("comments").select("song_id").in("song_id", ids);
      const m = new Map<string, number>();
      (data ?? []).forEach((r) => m.set(r.song_id!, (m.get(r.song_id!) ?? 0) + 1));
      return m;
    },
  });

  const favorites = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("favorites")
        .select("song:songs(id,title,cover_url,original_audio_path,processed_audio_path,play_count,like_count,singer:profiles!songs_singer_id_profiles_fkey(id,username,full_name))")
        .eq("user_id", user!.id)
        .limit(60);
      return (data ?? []).map((r) => r.song).filter(Boolean) as unknown as SongCardData[];
    },
  });

  async function deleteSong(s: MySong) {
    if (!confirm(`Delete "${s.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("songs").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    // best-effort remove files
    void supabase.storage.from("songs").remove([s.original_audio_path]);
    if (s.cover_url) void supabase.storage.from("covers").remove([s.cover_url]);
    toast.success("Song deleted");
    qc.invalidateQueries({ queryKey: ["my-songs"] });
  }

  if (!user || !profile) return null;

  const totalPlays = (mySongs.data ?? []).reduce((a, s) => a + (s.play_count ?? 0), 0);
  const totalLikes = (mySongs.data ?? []).reduce((a, s) => a + (s.like_count ?? 0), 0);
  const totalDownloads = (mySongs.data ?? []).reduce((a, s) => a + (s.download_count ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-gradient-card p-4 md:p-6">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-primary grid place-items-center text-2xl font-black text-primary-foreground">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (profile.username ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-2xl font-black truncate">{profile.full_name ?? profile.username}</h1>
          <div className="text-sm text-muted-foreground">@{profile.username}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => setProfileOpen(true)}>
            <Edit2 className="h-4 w-4" /> Edit profile
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/upload"><Upload className="h-4 w-4" /> Upload</Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      {(mySongs.data?.length ?? 0) > 0 ? (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatCard icon={Play} label="Total plays" value={formatCount(totalPlays)} />
          <StatCard icon={Heart} label="Total likes" value={formatCount(totalLikes)} />
          <StatCard icon={DownloadIcon} label="Downloads" value={formatCount(totalDownloads)} />
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg md:text-xl font-black mb-3 flex items-center gap-2">
          <Music2 className="h-5 w-5" /> My uploads
        </h2>
        {mySongs.data && mySongs.data.length > 0 ? (
          <div className="space-y-2">
            {mySongs.data.map((s) => (
              <MyUploadRow key={s.id} song={s} comments={commentCounts.data?.get(s.id) ?? 0} onDelete={() => deleteSong(s)} />
            ))}
          </div>
        ) : (
          <EmptyBox
            title="No uploads yet"
            body="Ready to share your sound? Upload your first track."
            action={<Button asChild className="bg-gradient-primary text-primary-foreground border-0 shadow-glow"><Link to="/upload">Upload a track</Link></Button>}
          />
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg md:text-xl font-black mb-3 flex items-center gap-2">
          <Heart className="h-5 w-5" /> Favorites
        </h2>
        {favorites.data && favorites.data.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {favorites.data.map((s) => <SongCard key={s.id} song={s} queue={favorites.data} />)}
          </div>
        ) : (
          <EmptyBox title="No favorites yet" body="Tap the bookmark on any track to save it here." />
        )}
      </section>

      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} onSaved={() => { refresh(); qc.invalidateQueries(); }} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-4">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon className="h-4 w-4" /></div>
      <div className="mt-2 text-2xl font-black">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

interface MySong {
  id: string;
  title: string;
  cover_url: string | null;
  original_audio_path: string;
  processed_audio_path: string | null;
  play_count: number;
  like_count: number;
  download_count: number;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  is_hidden: boolean;
  created_at: string;
}

function MyUploadRow({ song, comments, onDelete }: { song: MySong; comments: number; onDelete: () => void }) {
  const cover = useSignedUrl("covers", song.cover_url);
  const badge = song.status === "rejected"
    ? { icon: XCircle, cls: "bg-destructive/20 text-destructive", label: "Removed" }
    : song.is_hidden
    ? { icon: EyeOff, cls: "bg-warning/20 text-warning", label: "Hidden by moderator" }
    : { icon: CheckCircle2, cls: "bg-success/20 text-success", label: "Live" };
  const Icon = badge.icon;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
      <Link to="/song/$id" params={{ id: song.id }} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{song.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
              <Icon className="h-3 w-3" /> {badge.label}
            </span>
            <span>{timeAgo(song.created_at)}</span>
            <span className="inline-flex items-center gap-1"><Play className="h-3 w-3" />{formatCount(song.play_count)}</span>
            <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{formatCount(song.like_count)}</span>
            <span className="inline-flex items-center gap-1"><DownloadIcon className="h-3 w-3" />{formatCount(song.download_count)}</span>
            <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{formatCount(comments)}</span>
          </div>
          {song.status === "rejected" && song.rejection_reason ? (
            <div className="mt-1 text-xs text-destructive">Reason: {song.rejection_reason}</div>
          ) : null}
        </div>
      </Link>
      <div className="flex shrink-0 gap-1">
        <Button size="icon" variant="ghost" asChild aria-label="Edit"><Link to="/song/$id/edit" params={{ id: song.id }}><Edit2 className="h-4 w-4" /></Link></Button>
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function EmptyBox({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground">
        <ListMusic className="h-6 w-6" />
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function EditProfileDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({ full_name: "", bio: "", website: "", phone: "" });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name ?? "", bio: profile.bio ?? "", website: profile.website ?? "", phone: profile.phone ?? "" });
  }, [profile, open]);

  async function save() {
    if (!user) return;
    setBusy(true);
    try {
      let avatar_url = profile?.avatar_url ?? null;
      if (avatar) {
        if (avatar.size > 5 * 1024 * 1024) { toast.error("Avatar too large (max 5MB)"); return; }
        const ext = avatar.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatar, { upsert: true, contentType: avatar.type });
        if (upErr) throw upErr;
        if (profile?.avatar_url) invalidateSignedUrl("avatars", profile.avatar_url);
        avatar_url = path;
      }
      const { error } = await supabase.from("profiles").update({
        full_name: form.full_name.trim() || null,
        bio: form.bio.trim() || null,
        website: form.website.trim() || null,
        phone: form.phone.trim() || null,
        avatar_url,
      }).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Avatar</Label>
            <Input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1.5"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Bio</Label><Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={500} /></div>
          <div className="space-y-1.5"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="bg-gradient-primary text-primary-foreground border-0">{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
