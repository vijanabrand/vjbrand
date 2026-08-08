import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/hooks/use-auth-gate";

/** The signed-in user's saved songs (favorites table). */
export function useFavorites() {
  const { user, requireAuth } = useAuthGate();
  const qc = useQueryClient();

  const favorites = useQuery({
    queryKey: ["favorite-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("song_id").eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.song_id));
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ songId, next }: { songId: string; next: boolean }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = next
        ? await supabase.from("favorites").insert({ song_id: songId, user_id: user.id })
        : await supabase.from("favorites").delete().eq("song_id", songId).eq("user_id", user.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["favorite-ids"] });
      qc.invalidateQueries({ queryKey: ["favorite-songs"] });
      toast.success(next ? "Added to favorites" : "Removed from favorites");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update favorites"),
  });

  return {
    favoriteIds: favorites.data ?? new Set<string>(),
    isFavorite: (id: string) => favorites.data?.has(id) ?? false,
    isLoading: favorites.isLoading,
    toggleFavorite: (songId: string) => {
      if (!requireAuth("Please login to save favorites.")) return;
      mutation.mutate({ songId, next: !(favorites.data?.has(songId) ?? false) });
    },
    isSaving: mutation.isPending,
  };
}
