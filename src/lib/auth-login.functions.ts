import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Sign in with EITHER an email address or a username.
 * Username lookup happens server-side so member emails are never exposed to the client.
 * Returns the session tokens; the client hands them to supabase.auth.setSession().
 */
export const signInWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        identifier: z.string().trim().min(1, "Enter your email or username").max(255),
        password: z.string().min(1, "Enter your password").max(72),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL!;
    const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;

    let email = data.identifier;

    if (!email.includes("@")) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("username", data.identifier)
        .maybeSingle();
      if (!prof) return { error: "Invalid login credentials" as string, session: null };
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(prof.id);
      if (!userRes?.user?.email) return { error: "Invalid login credentials", session: null };
      email = userRes.user.email;
    }

    const anon = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (publishable.startsWith("sb_") && h.get("Authorization") === `Bearer ${publishable}`) {
            h.delete("Authorization");
          }
          h.set("apikey", publishable);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: signIn, error } = await anon.auth.signInWithPassword({ email, password: data.password });
    if (error || !signIn.session) {
      return { error: error?.message ?? "Invalid login credentials", session: null };
    }
    return {
      error: null,
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      },
    };
  });
