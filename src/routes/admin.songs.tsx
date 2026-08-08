import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Trash2, Star, Eye, EyeOff, Pin } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { formatCount, timeAgo } from "@/lib/format";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/songs")({
  head: () => ({ meta: [{ title: "Songs — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminSongs,
});

type Filter = "pending" | "approved" | "rejected" | "all";

function AdminSongs() {
  const [filter, setFilter] = useState<Filter>("approved");
  const [q, setQ] = useState("");
  const qc = useQueryClient();

  const songs = useQuery({
    queryKey: ["admin-songs", filter, q],
    queryFn: async () => {
      let query = supabase
        .from("songs")
        .select("id,title,cover_url,status,is_featured,is_pinned,is_hidden,play_count,like_count,created_at,rejection_reason,singer:profiles!songs_singer_id_profiles_fkey(username,full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") query = query.eq("status", filter);
      if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function update(id: string, patch: Partial<{ status: "pending" | "approved" | "rejected"; rejection_reason: string | null; is_featured: boolean; is_pinned: boolean; is_hidden: boolean }>, msg: string) {
    const { error } = await supabase.from("songs").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(msg);
    qc.invalidateQueries({ queryKey: ["admin-songs"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  async function del(id: string) {
    if (!confirm("Delete this song? This cannot be undone.")) return;
    const { error } = await supabase.from("songs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Song deleted");
    qc.invalidateQueries({ queryKey: ["admin-songs"] });
  }

  async function reject(id: string) {
    const reason = prompt("Rejection reason (shown to the artist):");
    if (!reason) return;
    await update(id, { status: "rejected", rejection_reason: reason }, "Song rejected");
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-2 overflow-x-auto">
          {(["approved", "pending", "rejected", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize whitespace-nowrap ${
                filter === f ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"
              }`}
            >
              {f === "approved" ? "Live" : f}
            </button>
          ))}
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title…" className="sm:ml-auto sm:max-w-xs" />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {(songs.data ?? []).map((s) => (
          <AdminSongRow
            key={s.id}
            s={s}
            onApprove={() => update(s.id, { status: "approved", rejection_reason: null }, "Approved")}
            onReject={() => reject(s.id)}
            onFeature={() => update(s.id, { is_featured: !s.is_featured }, s.is_featured ? "Unfeatured" : "Featured")}
            onPin={() => update(s.id, { is_pinned: !s.is_pinned }, s.is_pinned ? "Unpinned" : "Pinned")}
            onHide={() => update(s.id, { is_hidden: !s.is_hidden }, s.is_hidden ? "Visible" : "Hidden")}
            onDelete={() => del(s.id)}
          />
        ))}
        {songs.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">No songs in this filter.</div>
        ) : null}
      </div>
    </div>
  );
}

interface AdminSong {
  id: string;
  title: string;
  cover_url: string | null;
  status: string;
  is_featured: boolean;
  is_pinned: boolean;
  is_hidden: boolean;
  play_count: number;
  like_count: number;
  created_at: string;
  rejection_reason: string | null;
  singer: { username: string; full_name: string | null } | null;
}

function AdminSongRow({
  s, onApprove, onReject, onFeature, onPin, onHide, onDelete,
}: {
  s: AdminSong;
  onApprove: () => void; onReject: () => void; onFeature: () => void; onPin: () => void; onHide: () => void; onDelete: () => void;
}) {
  const cover = useSignedUrl("covers", s.cover_url);
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border p-3 last:border-b-0">
      <Link to="/song/$id" params={{ id: s.id }} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-primary" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{s.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {s.singer?.full_name ?? s.singer?.username ?? "Unknown"} · {timeAgo(s.created_at)} · {formatCount(s.play_count)} plays
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-1">
        {s.status !== "approved" ? (
          <Button size="sm" onClick={onApprove} className="bg-success/20 text-success border-0 hover:bg-success/30">
            <CheckCircle2 className="h-4 w-4" /> Approve
          </Button>
        ) : null}
        {s.status !== "rejected" ? (
          <Button size="sm" variant="outline" onClick={onReject}>
            <XCircle className="h-4 w-4" /> Reject
          </Button>
        ) : null}
        <Button size="icon" variant="ghost" onClick={onFeature} aria-label="Feature">
          <Star className={s.is_featured ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4"} />
        </Button>
        <Button size="icon" variant="ghost" onClick={onPin} aria-label="Pin">
          <Pin className={s.is_pinned ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"} />
        </Button>
        <Button size="icon" variant="ghost" onClick={onHide} aria-label={s.is_hidden ? "Show" : "Hide"}>
          {s.is_hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
