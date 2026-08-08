import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

/**
 * Guest-friendly gate for engagement actions.
 * Listening is always public — everything else routes to /auth and comes back.
 */
export function useAuthGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });

  function requireAuth(message = "Please login to continue.") {
    if (user) return true;
    if (loading) return false;
    toast.info(message);
    navigate({ to: "/auth", search: { redirect: href } });
    return false;
  }

  return { user, isAuthed: !!user, requireAuth };
}
