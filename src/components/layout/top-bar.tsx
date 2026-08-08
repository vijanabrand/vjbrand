import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Library, Upload, LayoutDashboard, User, Music2, LogOut, Bell, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function TopBar() {
  const { user, profile, isSinger, isAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggleTheme } = useTheme();

  const unread = useQuery({
    queryKey: ["notif-unread", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user!.id).eq("is_read", false);
      return count ?? 0;
    },
  });

  const navItems = [
    { to: "/", label: "Home", icon: Home },
    { to: "/search", label: "Search", icon: Search },
    ...(user ? [{ to: "/library", label: "Library", icon: Library }] : []),
    ...(isSinger ? [{ to: "/upload", label: "Upload", icon: Upload }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: LayoutDashboard }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Music2 className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="hidden sm:block">
            <div className="text-base font-black leading-none tracking-tight text-gradient">Vijana Brand</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Discover · Listen · Share</div>
          </div>
        </Link>

        <nav className="ml-6 hidden md:flex items-center gap-1">
          {navItems.map((it) => {
            const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {user ? (
            <>
              <Link to="/notifications" className="relative rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {(unread.data ?? 0) > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {unread.data! > 9 ? "9+" : unread.data}
                  </span>
                ) : null}
              </Link>
              <Link
                to="/me"
                className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary"
              >
                <div className="grid h-6 w-6 place-items-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                  {(profile?.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <span className="truncate max-w-[120px]">{profile?.username ?? "Profile"}</span>
              </Link>
              <Button size="icon" variant="ghost" onClick={() => void signOut()} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button size="sm" className="bg-gradient-primary text-primary-foreground border-0 shadow-glow" asChild>
                <Link to="/auth" search={{ mode: "signup" }}>Join free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
