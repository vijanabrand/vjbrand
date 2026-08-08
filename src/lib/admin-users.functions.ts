import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertRole(supabase: any, userId: string, role: "admin" | "super_admin") {
  if (role === "super_admin") {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!data) throw new Error("Only super admins can do this");
    return;
  }
  const { data } = await supabase.rpc("is_admin", { _user_id: userId });
  if (!data) throw new Error("Admins only");
}

/** The permanent super admin account may only be touched by itself. */
async function assertNotProtectedTarget(targetId: string, callerId: string) {
  if (targetId === callerId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", targetId);
  if ((data ?? []).some((r) => r.role === "super_admin")) {
    throw new Error("The permanent super admin account is protected and cannot be modified");
  }
}

function friendlyAuthError(message: string) {
  if (/already|registered|exists|duplicate/i.test(message)) return "This email is already registered.";
  return message;
}


/** Email addresses for the admin user table (admins + super admins). */
export const adminListUserEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emails: Record<string, string> = {};
    let page = 1;
    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      data.users.forEach((u) => { if (u.email) emails[u.id] = u.email; });
      if (data.users.length < 200) break;
      page += 1;
      if (page > 25) break;
    }
    return emails;
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(6, "Password must be at least 6 characters").max(72),
        fullName: z.string().trim().min(2).max(80),
        username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
        role: z.enum(["admin", "singer", "listener"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, "super_admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Enforce unique email + unique username before creating anything.

    const { data: dupUsername } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    if (dupUsername) throw new Error("This username is already taken.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, username: data.username },
    });
    if (error) throw new Error(friendlyAuthError(error.message));
    const uid = created.user!.id;
    if (data.role === "admin") {
      const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (rErr) throw new Error(rErr.message);
    }
    return { id: uid };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        fullName: z.string().trim().min(2).max(80).optional(),
        username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
        email: z.string().trim().email().max(255).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, "super_admin");
    await assertNotProtectedTarget(data.userId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.username) {
      const { data: dup } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("username", data.username)
        .maybeSingle();
      if (dup && dup.id !== data.userId) throw new Error("This username is already taken.");
    }
    if (data.email) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { email: data.email });
      if (error) throw new Error(friendlyAuthError(error.message));
    }
    const patch: { full_name?: string; username?: string } = {};
    if (data.fullName) patch.full_name = data.fullName;
    if (data.username) patch.username = data.username;
    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(6).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, "super_admin");
    await assertNotProtectedTarget(data.userId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, "super_admin");
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if ((target ?? []).some((r) => r.role === "super_admin")) {
      throw new Error("Super admin accounts cannot be deleted here");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
