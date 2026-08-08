import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Role = "super_admin" | "admin" | "singer" | "listener";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Tables<"profiles"> | null;
  roles: Role[];
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isSinger: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const identityRequest = useRef(0);
  const bootstrapped = useRef(false);

  async function loadProfile(userId: string, requestId = ++identityRequest.current) {
    try {
      const [{ data: prof, error: profileError }, { data: r, error: rolesError }, { data: adminAccess }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.rpc("is_admin", { _user_id: userId }),
      ]);
      if (requestId !== identityRequest.current) return;
      if (profileError) throw profileError;
      setProfile(prof ?? null);
      const resolvedRoles = rolesError ? [] : (r ?? []).map((x) => x.role as Role);
      // The server-validated role helper prevents a transient role query failure
      // from locking a legitimate moderator out of the dashboard.
      if (adminAccess && !resolvedRoles.includes("admin") && !resolvedRoles.includes("super_admin")) {
        resolvedRoles.push("admin");
      }
      setRoles(resolvedRoles);
    } catch (error) {
      if (requestId !== identityRequest.current) return;
      console.error("Could not load account permissions", error);
      setProfile(null);
      setRoles([]);
    }
  }

  useEffect(() => {
    let alive = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // getSession/getUser below owns the initial hydration. Supabase can emit
      // INITIAL_SESSION with null before persisted storage has finished loading;
      // treating that as signed out causes protected pages to redirect to /auth.
      if (event === "INITIAL_SESSION" && !bootstrapped.current) return;

      const requestId = ++identityRequest.current;
      setSession(s);
      if (s?.user) {
        // Only re-resolve identity on real identity transitions.
        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          setLoading(true);
          setTimeout(() => {
            void loadProfile(s.user.id, requestId).finally(() => {
              if (alive && requestId === identityRequest.current) setLoading(false);
            });
          }, 0);
        } else {
          setLoading(false);
        }
      } else {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });

    void (async () => {
      const requestId = ++identityRequest.current;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!alive || requestId !== identityRequest.current) return;

        const persistedSession = sessionData.session;
        if (!persistedSession) {
          setSession(null);
          setProfile(null);
          setRoles([]);
          return;
        }

        const { data, error } = await supabase.auth.getUser();
        if (!alive || requestId !== identityRequest.current) return;
        if (error || !data.user || data.user.id !== persistedSession.user.id) {
          setSession(null);
          setProfile(null);
          setRoles([]);
          return;
        }

        setSession(persistedSession);
        await loadProfile(data.user.id, requestId);
      } catch (error) {
        if (alive && requestId === identityRequest.current) {
          console.error("Could not restore your session", error);
          setSession(null);
          setProfile(null);
          setRoles([]);
        }
      } finally {
        bootstrapped.current = true;
        if (alive && requestId === identityRequest.current) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);


  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    loading,
    isAdmin: roles.includes("admin") || roles.includes("super_admin"),
    isSuperAdmin: roles.includes("super_admin"),
    isSinger: roles.includes("singer") || roles.includes("admin") || roles.includes("super_admin"),
    refresh: async () => {
      if (session?.user) await loadProfile(session.user.id);
    },
    signOut: async () => {
      identityRequest.current += 1;
      setSession(null);
      setProfile(null);
      setRoles([]);
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
