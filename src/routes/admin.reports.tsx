import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { CheckCircle2, ShieldAlert, Trash2, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/format";
import { useState } from "react";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — Admin", }, { name: "robots", content: "noindex" }] }),
  component: AdminReports,
});

function AdminReports() {
  const qc = useQueryClient();
  const [showResolved, setShowResolved] = useState(false);

  const reports = useQuery({
    queryKey: ["admin-reports", showResolved],
    queryFn: async () => {
      let q = supabase
        .from("reports")
        .select("id,reason,resolved,created_at,song_id,comment_id,reporter_id,song:songs(id,title,is_hidden),comment:comments(id,content,song_id,user_id,user:profiles!comments_user_id_profiles_fkey(username))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!showResolved) q = q.eq("resolved", false);
      const { data } = await q;
      return data ?? [];
    },
  });

  async function resolve(id: string) {
    const { error } = await supabase.from("reports").update({ resolved: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked resolved");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  }

  async function deleteComment(commentId: string, reportId: string) {
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) return toast.error(error.message);
    await supabase.from("reports").update({ resolved: true }).eq("id", reportId);
    toast.success("Comment deleted");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  }

  async function hideSong(songId: string, reportId: string) {
    const { error } = await supabase.from("songs").update({ is_hidden: true }).eq("id", songId);
    if (error) return toast.error(error.message);
    await supabase.from("reports").update({ resolved: true }).eq("id", reportId);
    toast.success("Song hidden");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setShowResolved(false)} className={`rounded-full px-4 py-1.5 text-xs font-semibold ${!showResolved ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}>Open</button>
        <button onClick={() => setShowResolved(true)} className={`rounded-full px-4 py-1.5 text-xs font-semibold ${showResolved ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}>All</button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {(reports.data ?? []).map((r) => (
          <div key={r.id} className="flex flex-wrap items-start gap-3 border-b border-border p-3 last:border-b-0">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${r.resolved ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm">
                {r.song_id && r.song ? (
                  <Link to="/song/$id" params={{ id: r.song_id }} className="font-semibold hover:text-primary">Song: {r.song.title}</Link>
                ) : r.comment ? (
                  <span className="font-semibold">Comment by @{r.comment.user?.username ?? "user"}</span>
                ) : (
                  <span>Report</span>
                )}
              </div>
              {r.comment ? (
                <div className="mt-1 rounded-lg bg-secondary/50 p-2 text-xs italic">"{r.comment.content}"</div>
              ) : null}
              <div className="mt-1 text-xs text-muted-foreground">
                Reason: {r.reason} · {timeAgo(r.created_at)}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {!r.resolved && r.comment ? (
                <Button size="sm" variant="outline" onClick={() => deleteComment(r.comment!.id, r.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4" /> Delete comment
                </Button>
              ) : null}
              {!r.resolved && r.song && !r.song.is_hidden ? (
                <Button size="sm" variant="outline" onClick={() => hideSong(r.song!.id, r.id)}>
                  <EyeOff className="h-4 w-4" /> Hide song
                </Button>
              ) : null}
              {!r.resolved ? (
                <Button size="sm" onClick={() => resolve(r.id)}>
                  <CheckCircle2 className="h-4 w-4" /> Resolve
                </Button>
              ) : (
                <span className="text-xs text-success font-semibold">Resolved</span>
              )}
            </div>
          </div>
        ))}
        {reports.data?.length === 0 ? <div className="p-10 text-center text-muted-foreground text-sm">No reports.</div> : null}
      </div>
    </div>
  );
}
