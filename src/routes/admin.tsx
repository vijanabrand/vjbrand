import { createFileRoute, useNavigate, Link, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, Music2, Users, ShieldAlert, MessageCircle, Settings, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Vijana Brand" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminShell,
});

function AdminShell() {
  const { user, isAdmin, isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/admin" }, replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Signed in but not a moderator: explain instead of silently bouncing home.
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn&apos;t have moderator access. If this is unexpected, ask a super admin to grant you the
          admin role.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-full bg-gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          Back to home
        </Link>
      </div>
    );
  }


  const tabs = [
    { to: "/admin", label: "Overview", icon: LayoutDashboard, activeOptions: { exact: true } },
    { to: "/admin/songs", label: "Songs", icon: Music2 },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/comments", label: "Comments", icon: MessageCircle },
    { to: "/admin/reports", label: "Reports", icon: ShieldAlert },
    ...(isSuperAdmin ? [{ to: "/admin/content", label: "Site content", icon: Settings }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
          <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">Moderate content and users</p>
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={t.activeOptions}
            activeProps={{
              className: "bg-secondary text-foreground font-semibold",
            }}
            inactiveProps={{
              className: "text-muted-foreground hover:text-foreground",
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors"
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </Link>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
