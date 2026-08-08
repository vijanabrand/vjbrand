import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Shield, ShieldOff, Ban, CheckCircle2, Loader2, UserPlus, Pencil, KeyRound, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import {
  adminCreateUser,
  adminDeleteUser,
  adminListUserEmails,
  adminResetPassword,
  adminUpdateUser,
} from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

type Filter = "all" | "admins" | "singers" | "listeners" | "suspended";

function AdminUsers() {
  const { isSuperAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const qc = useQueryClient();

  const users = useQuery({
    queryKey: ["admin-users", q],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,is_suspended,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (q.trim()) {
        const t = `%${q.trim()}%`;
        query = query.or(`username.ilike.${t},full_name.ilike.${t}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const roles = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      const map = new Map<string, string[]>();
      (data ?? []).forEach((r) => {
        const arr = map.get(r.user_id) ?? [];
        arr.push(r.role as string);
        map.set(r.user_id, arr);
      });
      return map;
    },
  });

  const emails = useQuery({
    queryKey: ["admin-user-emails"],
    queryFn: async () => (await adminListUserEmails()) as Record<string, string>,
    retry: false,
  });

  async function toggleSuspend(id: string, current: boolean) {
    const { error } = await supabase.from("profiles").update({ is_suspended: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(current ? "User reactivated" : "User suspended");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function toggleRole(userId: string, role: "admin" | "singer", has: boolean) {
    if (!isSuperAdmin && role === "admin") {
      toast.error("Only super admins can manage admin roles");
      return;
    }
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    }
    toast.success("Roles updated");
    qc.invalidateQueries({ queryKey: ["admin-user-roles"] });
  }

  const list = (users.data ?? []).filter((u) => {
    const r = roles.data?.get(u.id) ?? [];
    if (filter === "admins") return r.includes("admin") || r.includes("super_admin");
    if (filter === "singers") return r.includes("singer");
    if (filter === "listeners") return !r.includes("admin") && !r.includes("super_admin");
    if (filter === "suspended") return u.is_suspended;
    return true;
  });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "admins", label: "Admins" },
    { key: "singers", label: "Singers" },
    { key: "listeners", label: "Listeners" },
    { key: "suspended", label: "Suspended" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or username…"
          className="max-w-xs flex-1"
        />
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "secondary" : "ghost"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {isSuperAdmin ? <CreateUserDialog onDone={() => qc.invalidateQueries()} /> : null}
      </div>

      {users.isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No users match this filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {list.map((u) => {
            const userRoles = roles.data?.get(u.id) ?? [];
            const hasAdmin = userRoles.includes("admin") || userRoles.includes("super_admin");
            const hasSinger = userRoles.includes("singer");
            const isSuper = userRoles.includes("super_admin");
            const email = emails.data?.[u.id];
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 border-b border-border p-3 last:border-b-0">
                <Link to="/artist/$id" params={{ id: u.id }} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
                    {(u.username ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {u.full_name ?? u.username}
                      {isSuper ? (
                        <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-primary">SUPER</span>
                      ) : null}
                      {u.is_suspended ? (
                        <span className="ml-2 rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] text-destructive">
                          SUSPENDED
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      @{u.username}
                      {email ? ` · ${email}` : ""} · {timeAgo(u.created_at)} · {userRoles.join(", ") || "listener"}
                    </div>
                  </div>
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={hasSinger ? "secondary" : "outline"}
                    onClick={() => toggleRole(u.id, "singer", hasSinger)}
                    disabled={isSuper}
                  >
                    {hasSinger ? "Revoke singer" : "Grant singer"}
                  </Button>
                  {isSuperAdmin ? (
                    <Button
                      size="sm"
                      variant={hasAdmin ? "secondary" : "outline"}
                      onClick={() => toggleRole(u.id, "admin", hasAdmin)}
                      disabled={isSuper}
                    >
                      {hasAdmin ? (
                        <>
                          <ShieldOff className="h-4 w-4" /> Revoke admin
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4" /> Make admin
                        </>
                      )}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant={u.is_suspended ? "default" : "outline"}
                    onClick={() => toggleSuspend(u.id, u.is_suspended)}
                    disabled={isSuper}
                    className={u.is_suspended ? "border-0 bg-success/20 text-success" : ""}
                  >
                    {u.is_suspended ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Activate
                      </>
                    ) : (
                      <>
                        <Ban className="h-4 w-4" /> Suspend
                      </>
                    )}
                  </Button>
                  {isSuperAdmin && !isSuper ? (
                    <>
                      <EditUserDialog
                        userId={u.id}
                        fullName={u.full_name ?? ""}
                        username={u.username}
                        email={email}
                        onDone={() => qc.invalidateQueries()}
                      />
                      <ResetPasswordDialog userId={u.id} username={u.username} />
                      <DeleteUserButton userId={u.id} username={u.username} onDone={() => qc.invalidateQueries()} />
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateUserDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: "", username: "", email: "", password: "" });
  const [role, setRole] = useState<"admin" | "singer" | "listener">("admin");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    try {
      await adminCreateUser({ data: { ...form, role } });
      toast.success("Account created");
      setOpen(false);
      setForm({ fullName: "", username: "", email: "", password: "" });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="border-0 bg-gradient-primary text-primary-foreground">
          <UserPlus className="h-4 w-4" /> New account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create account</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 6 characters"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <div className="flex gap-1">
              {(["admin", "singer", "listener"] as const).map((r) => (
                <Button key={r} type="button" size="sm" variant={role === r ? "secondary" : "outline"} onClick={() => setRole(r)}>
                  {r}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="border-0 bg-gradient-primary text-primary-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  userId,
  fullName,
  username,
  email,
  onDone,
}: {
  userId: string;
  fullName: string;
  username: string;
  email?: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName, username, email: email ?? "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await adminUpdateUser({
        data: {
          userId,
          fullName: form.fullName,
          username: form.username,
          email: form.email && form.email !== email ? form.email : undefined,
        },
      });
      toast.success("Account updated");
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label="Edit account">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit @{username}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="border-0 bg-gradient-primary text-primary-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ userId, username }: { userId: string; username: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    try {
      await adminResetPassword({ data: { userId, password } });
      toast.success("Password reset");
      setOpen(false);
      setPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label="Reset password">
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for @{username}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="border-0 bg-gradient-primary text-primary-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserButton({ userId, username, onDone }: { userId: string; username: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    setBusy(true);
    try {
      await adminDeleteUser({ data: { userId } });
      toast.success("Account deleted");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" aria-label="Delete account" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete @{username}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the account and everything they uploaded. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={del} disabled={busy} className="bg-destructive text-destructive-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
