import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SongCard, type SongCardData } from "@/components/song/song-card";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, X, Users, Music2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getSignedUrl } from "@/lib/storage-urls";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  q: z.string().optional(),
  genre: z.string().optional(),
  tab: z.enum(["songs", "people"]).optional(),
});
type SearchParams = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Search songs & artists — Vijana Brand" },
      { name: "description", content: "Search songs, albums, genres and artist profiles on Vijana Brand." },
      { property: "og:title", content: "Search songs & artists — Vijana Brand" },
      { property: "og:description", content: "Find tracks and discover new artists on Vijana Brand." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function useDebounced<T>(v: T, delay = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), delay);
    return () => clearTimeout(t);
  }, [v, delay]);
  return d;
}

interface PersonRow {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

function SearchPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q ?? "");
  const debounced = useDebounced(q);
  const tab = search.tab ?? "songs";

  useEffect(() => {
    navigate({ search: (s: SearchParams) => ({ ...s, q: debounced || undefined }), replace: true });
  }, [debounced, navigate]);

  const genres = useQuery({
    queryKey: ["genres-all"],
    queryFn: async () => (await supabase.from("genres").select("*").order("name")).data ?? [],
  });

  const genreId = useQuery({
    queryKey: ["genre-id", search.genre],
    enabled: !!search.genre,
    queryFn: async () => {
      if (!search.genre) return null;
      const { data } = await supabase.from("genres").select("id").eq("slug", search.genre).maybeSingle();
      return data?.id ?? null;
    },
  });

  const results = useQuery({
    queryKey: ["search", debounced, genreId.data],
    enabled: tab === "songs",
    queryFn: async () => {
      let q1 = supabase
        .from("songs")
        .select(
          "id,title,cover_url,original_audio_path,processed_audio_path,play_count,like_count,singer:profiles!songs_singer_id_profiles_fkey(id,username,full_name)",
        )
        .neq("status", "rejected")
        .eq("is_hidden", false)
        .order("play_count", { ascending: false })
        .limit(60);
      if (genreId.data) q1 = q1.eq("genre_id", genreId.data);
      if (debounced.trim()) {
        const term = `%${debounced.trim()}%`;
        q1 = q1.or(`title.ilike.${term},album.ilike.${term}`);
      }
      const { data } = await q1;
      return (data ?? []) as unknown as SongCardData[];
    },
  });

  const people = useQuery({
    queryKey: ["search-people", debounced],
    enabled: tab === "people",
    queryFn: async () => {
      let q1 = supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,bio")
        .eq("is_suspended", false)
        .order("username")
        .limit(50);
      if (debounced.trim()) {
        const term = `%${debounced.trim()}%`;
        q1 = q1.or(`username.ilike.${term},full_name.ilike.${term}`);
      }
      const { data, error } = await q1;
      if (error) throw error;
      return (data ?? []) as PersonRow[];
    },
  });

  function setTab(next: "songs" | "people") {
    navigate({ search: (s: SearchParams) => ({ ...s, tab: next }), replace: true });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-10">
      <h1 className="sr-only">Search Vijana Brand</h1>
      <div className="mb-6">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "songs" ? "Search songs, albums…" : "Search people by name or username…"}
            className="h-14 rounded-2xl pl-12 pr-12 text-base"
          />
          {q ? (
            <button
              onClick={() => setQ("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="mt-4 inline-flex rounded-full border border-border bg-secondary/60 p-1">
          <TabButton active={tab === "songs"} onClick={() => setTab("songs")}>
            <Music2 className="h-4 w-4" /> Songs
          </TabButton>
          <TabButton active={tab === "people"} onClick={() => setTab("people")}>
            <Users className="h-4 w-4" /> People
          </TabButton>
        </div>

        {tab === "songs" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <FilterChip
              active={!search.genre}
              onClick={() => navigate({ search: (s: SearchParams) => ({ ...s, genre: undefined }), replace: true })}
            >
              All
            </FilterChip>
            {(genres.data ?? []).map((g) => (
              <FilterChip
                key={g.id}
                active={search.genre === g.slug}
                onClick={() => navigate({ search: (s: SearchParams) => ({ ...s, genre: g.slug }), replace: true })}
              >
                {g.name}
              </FilterChip>
            ))}
          </div>
        ) : null}
      </div>

      {tab === "songs" ? (
        results.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : results.data && results.data.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {results.data.map((s) => <SongCard key={s.id} song={s} queue={results.data} />)}
          </div>
        ) : (
          <EmptyState text={debounced ? `No songs match "${debounced}"` : "No songs found."} />
        )
      ) : people.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : people.data && people.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.data.map((p) => <PersonCard key={p.id} person={p} />)}
        </div>
      ) : (
        <EmptyState text={debounced ? `No people match "${debounced}"` : "Start typing to find artists and listeners."} />
      )}
    </div>
  );
}

function PersonCard({ person }: { person: PersonRow }) {
  const [avatar, setAvatar] = useState<string | null>(null);
  useEffect(() => {
    if (person.avatar_url) getSignedUrl("avatars", person.avatar_url).then(setAvatar);
  }, [person.avatar_url]);
  const name = person.full_name ?? person.username;
  return (
    <Link
      to="/artist/$id"
      params={{ id: person.id }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-secondary/60"
    >
      {avatar ? (
        <img src={avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-primary text-base font-black text-primary-foreground">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-bold">{name}</div>
        <div className="truncate text-xs text-muted-foreground">@{person.username}</div>
        {person.bio ? <p className="truncate text-xs text-muted-foreground/80">{person.bio}</p> : null}
      </div>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">{text}</div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
