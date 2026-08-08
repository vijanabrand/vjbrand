import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Vijana Brand" },
      { name: "description", content: "The rules for uploading, sharing and listening to music on Vijana Brand." },
      { property: "og:title", content: "Terms of Service — Vijana Brand" },
      { property: "og:description", content: "The rules for uploading, sharing and listening to music on Vijana Brand." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage slug="terms" />,
});

export function LegalPage({ slug }: { slug: string }) {
  const page = useQuery({
    queryKey: ["site-page", slug],
    queryFn: async () => {
      const { data } = await supabase.from("site_pages").select("title,content,updated_at").eq("slug", slug).maybeSingle();
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {page.isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !page.data ? (
        <p className="py-20 text-center text-sm text-muted-foreground">This page is not available yet.</p>
      ) : (
        <article className="rounded-3xl border border-border bg-card p-6">
          <h1 className="text-2xl font-black tracking-tight">{page.data.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Last updated {new Date(page.data.updated_at).toLocaleDateString()}
          </p>
          <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{page.data.content}</div>
        </article>
      )}
    </div>
  );
}
