import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Heart, MessageCircle, UserPlus, Music2, Check } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Vijana Brand" }, { name: "robots", content: "noindex" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/notifications" }, replace: true });
  }, [loading, user, navigate]);

  const items = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  async function markAllRead() {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    toast.success("All caught up");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  const icon = (type: string) => {
    if (type === "like") return Heart;
    if (type === "comment" || type === "reply") return MessageCircle;
    if (type === "follow") return UserPlus;
    return Music2;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black flex items-center gap-2"><Bell className="h-6 w-6" /> Notifications</h1>
        {(items.data ?? []).some((n) => !n.is_read) ? (
          <Button size="sm" variant="outline" onClick={markAllRead}><Check className="h-4 w-4" /> Mark all read</Button>
        ) : null}
      </div>

      {items.data && items.data.length > 0 ? (
        <div className="space-y-2">
          {items.data.map((n) => {
            const Icon = icon(n.type);
            const body = (
              <div className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${n.is_read ? "border-border/40 bg-card/40" : "border-primary/40 bg-primary/5"}`}>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{n.title}</div>
                  {n.body ? <div className="text-sm text-muted-foreground line-clamp-2">{n.body}</div> : null}
                  <div className="mt-1 text-xs text-muted-foreground">{timeAgo(n.created_at)}</div>
                </div>
              </div>
            );
            return n.link ? (
              <a key={n.id} href={n.link}>{body}</a>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          You're all caught up. New likes, comments and follows will show up here.
        </div>
      )}
    </div>
  );
}
