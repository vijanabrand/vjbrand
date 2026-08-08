import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, MessageCircle } from "lucide-react";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/admin/comments")({
  component: AdminComments,
});

function AdminComments() {
  const [q, setQ] = useState("");
  const qc = useQueryClient();

  const comments = useQuery({
    queryKey: ["admin-comments", q],
    queryFn: async () => {
      let query = supabase
        .from("comments")
        .select(
          "id,content,created_at,song_id,user_id,user:profiles!comments_user_id_profiles_fkey(username,full_name),song:songs!comments_song_id_fkey(title)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (q.trim()) query = query.ilike("content", `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function del(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Comment deleted");
    qc.invalidateQueries({ queryKey: ["admin-comments"] });
  }

  return (
    <div>
      <div className="mb-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search comments…" className="max-w-sm" />
      </div>

      {comments.isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (comments.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <MessageCircle className="mx-auto mb-2 h-6 w-6" />
          No comments found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {(comments.data ?? []).map((c) => (
            <div key={c.id} className="flex items-start gap-3 border-b border-border p-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {c.user?.full_name ?? c.user?.username ?? "User"}
                  </span>{" "}
                  on{" "}
                  <Link to="/song/$id" params={{ id: c.song_id }} className="text-primary hover:underline">
                    {c.song?.title ?? "song"}
                  </Link>{" "}
                  · {timeAgo(c.created_at)}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.content}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" aria-label="Delete comment">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => del(c.id)}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
