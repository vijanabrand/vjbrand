import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SongPost, type FeedSong } from "@/components/song/song-post";
import { Music2, Sparkles, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vijana Brand — Music feed from independent artists" },
      {
        name: "description",
        content:
          "Scroll the Vijana Brand feed to discover, play, like and download songs from independent African artists. Free to listen, easy to upload.",
      },
      { property: "og:title", content: "Vijana Brand — Music feed from independent artists" },
      {
        property: "og:description",
        content: "Discover new music post by post. Play instantly, like, comment and download.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const PAGE = 8;
const SONG_SELECT =
  "id,title,description,cover_url,original_audio_path,processed_audio_path,play_count,like_count,created_at,singer:profiles!songs_singer_id_profiles_fkey(id,username,full_name,avatar_url)";

function useFeed() {
  return useInfiniteQuery({
    queryKey: ["feed"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE;
      const { data, error } = await supabase
        .from("songs")
        .select(SONG_SELECT)
        .eq("is_hidden", false)
        .neq("status", "rejected")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      return (data ?? []) as unknown as FeedSong[];
    },
    getNextPageParam: (last, pages) => (last.length < PAGE ? undefined : pages.length),
  });
}

function useMyLikes(songIds: string[], userId?: string) {
  return useQuery({
    queryKey: ["feed-likes", userId, songIds.length],
    enabled: !!userId && songIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("song_likes")
        .select("song_id")
        .eq("user_id", userId!)
        .in("song_id", songIds);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.song_id));
    },
  });
}

function HomePage() {
  const { user, isSinger } = useAuth();
  const feed = useFeed();
  const songs = feed.data?.pages.flat() ?? [];
  const likes = useMyLikes(songs.map((s) => s.id), user?.id);
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) {
        feed.fetchNextPage();
      }
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [feed]);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-90" />
        <div className="absolute inset-0 bg-gradient-glow" />
        <div className="relative mx-auto max-w-2xl px-4 py-10 md:py-14">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            <Sparkles className="h-3 w-3" /> New sounds, every day
          </span>
          <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-white">
            Your music feed
          </h1>
          <p className="mt-3 max-w-xl text-sm md:text-base text-white/85">
            Scroll, tap play, and keep browsing while the music plays. No playlists, just great tracks from independent artists.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {isSinger ? (
              <Button className="bg-white text-background hover:bg-white/90 border-0" asChild>
                <Link to="/upload">
                  <Upload className="h-4 w-4" /> Upload your track
                </Link>
              </Button>
            ) : !user ? (
              <>
                <Button className="bg-white text-background hover:bg-white/90 border-0" asChild>
                  <Link to="/auth" search={{ mode: "signup" }}>Join free</Link>
                </Button>
                <Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20" asChild>
                  <Link to="/search">Search music</Link>
                </Button>
              </>
            ) : (
              <Button className="bg-white text-background hover:bg-white/90 border-0" asChild>
                <Link to="/search">Search music</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* FEED */}
      <div className="mx-auto max-w-2xl px-3 py-6 sm:px-4 md:py-8">
        {feed.isLoading ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-border bg-card">
                <div className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 rounded-full bg-secondary animate-pulse" />
                  <div className="h-3 w-32 rounded bg-secondary animate-pulse" />
                </div>
                <div className="aspect-square w-full bg-secondary animate-pulse sm:aspect-[4/3]" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-2/3 rounded bg-secondary animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-secondary animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : feed.isError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center text-sm">
            Couldn't load the feed.{" "}
            <button onClick={() => feed.refetch()} className="font-semibold underline">Try again</button>
          </div>
        ) : songs.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <div className="space-y-6">
            {songs.map((s) => (
              <SongPost key={s.id} song={s} liked={likes.data?.has(s.id)} queue={songs} />
            ))}
          </div>
        )}

        <div ref={sentinel} className="h-10" />
        {feed.isFetchingNextPage ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {!feed.hasNextPage && songs.length > 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">You're all caught up 🎧</p>
        ) : null}
      </div>
    </div>
  );
}

function EmptyLibrary() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-gradient-card p-10 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
        <Music2 className="h-8 w-8 text-primary-foreground" />
      </div>
      <h2 className="mt-4 text-xl font-bold">The feed is empty — for now</h2>
      <p className="mt-2 mx-auto max-w-md text-sm text-muted-foreground">
        No songs yet. Sign up and be the first to drop a track — it goes live instantly.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button className="bg-gradient-primary text-primary-foreground border-0 shadow-glow" asChild>
          <Link to="/auth" search={{ mode: "signup" }}>Create an account</Link>
        </Button>
      </div>
    </div>
  );
}
