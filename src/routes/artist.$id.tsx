import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SongCard, type SongCardData } from "@/components/song/song-card";
import { Music2, Users, UserPlus, UserCheck, Globe } from "lucide-react";
import { formatCount } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/artist/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("profiles")
      .select("id,username,full_name,avatar_url,cover_url,bio,website,created_at")
      .eq("id", params.id)
      .maybeSingle();
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.full_name ?? loaderData?.username ?? "Artist"} — Vijana Brand` },
      { name: "description", content: (loaderData?.bio ?? `Listen to tracks from ${loaderData?.full_name ?? loaderData?.username} on Vijana Brand.`).slice(0, 160) },
    ],
  }),
  component: ArtistPage,
});

function ArtistPage() {
  const artist = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const avatar = useSignedUrl("avatars", artist.avatar_url);
  const cover = useSignedUrl("covers", artist.cover_url);
  const isSelf = user?.id === artist.id;

  const songs = useQuery({
    queryKey: ["artist-songs", artist.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("songs")
        .select(
          "id,title,cover_url,original_audio_path,processed_audio_path,play_count,like_count,singer:profiles!songs_singer_id_profiles_fkey(id,username,full_name)",
        )
        .eq("singer_id", artist.id)
        .neq("status", "rejected")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as SongCardData[];
    },
  });

  const followers = useQuery({
    queryKey: ["followers", artist.id],
    queryFn: async () => {
      const { count } = await supabase.from("followers").select("*", { count: "exact", head: true }).eq("following_id", artist.id);
      return count ?? 0;
    },
  });

  const isFollowing = useQuery({
    queryKey: ["following", artist.id, user?.id],
    enabled: !!user && !isSelf,
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("followers").select("follower_id").eq("follower_id", user.id).eq("following_id", artist.id).maybeSingle();
      return !!data;
    },
  });

  async function toggleFollow() {
    if (!user) { navigate({ to: "/auth", search: { redirect: `/artist/${artist.id}` } }); return; }
    if (isFollowing.data) {
      const { error } = await supabase.from("followers").delete().eq("follower_id", user.id).eq("following_id", artist.id);
      if (error) return toast.error(error.message);
      toast.success("Unfollowed");
    } else {
      const { error } = await supabase.from("followers").insert({ follower_id: user.id, following_id: artist.id });
      if (error) return toast.error(error.message);
      toast.success("Following");
    }
    qc.invalidateQueries({ queryKey: ["following", artist.id] });
    qc.invalidateQueries({ queryKey: ["followers", artist.id] });
  }

  return (
    <div>
      <div className="relative h-40 md:h-56 overflow-hidden">
        {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-hero" />}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
      </div>
      <div className="mx-auto max-w-5xl px-4 -mt-16 relative">
        <div className="flex flex-wrap items-end gap-4">
          <div className="h-28 w-28 md:h-32 md:w-32 shrink-0 rounded-full border-4 border-background overflow-hidden bg-gradient-primary grid place-items-center shadow-elevated">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <span className="text-3xl font-black text-primary-foreground">{(artist.username ?? "?").slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="min-w-0 flex-1 pb-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate">{artist.full_name ?? artist.username}</h1>
            <div className="text-sm text-muted-foreground">@{artist.username}</div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {formatCount(followers.data ?? 0)} followers</span>
              <span className="inline-flex items-center gap-1"><Music2 className="h-3 w-3" /> {songs.data?.length ?? 0} tracks</span>
              {artist.website ? (
                <a href={artist.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                  <Globe className="h-3 w-3" /> Website
                </a>
              ) : null}
            </div>
          </div>
          <div className="pb-2">
            {isSelf ? (
              <Button asChild variant="outline" className="rounded-full"><Link to="/me">Edit profile</Link></Button>
            ) : (
              <Button onClick={toggleFollow} className={`rounded-full ${isFollowing.data ? "" : "bg-gradient-primary text-primary-foreground border-0 shadow-glow"}`} variant={isFollowing.data ? "outline" : "default"}>
                {isFollowing.data ? <><UserCheck className="h-4 w-4" /> Following</> : <><UserPlus className="h-4 w-4" /> Follow</>}
              </Button>
            )}
          </div>
        </div>

        {artist.bio ? <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{artist.bio}</p> : null}
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="text-xl font-black mb-4">Tracks</h2>
        {songs.data && songs.data.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {songs.data.map((s) => <SongCard key={s.id} song={s} queue={songs.data} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">No tracks yet.</div>
        )}
      </div>
    </div>
  );
}
