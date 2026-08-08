import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Library, Upload, LayoutDashboard, User, Bell } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { user, isSinger, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
    { to: "/search", label: "Search", icon: Search, match: (p: string) => p.startsWith("/search") },
    ...(user
      ? [{ to: "/library", label: "Library", icon: Library, match: (p: string) => p.startsWith("/library") }]
      : []),
    ...(isSinger
      ? [{ to: "/upload", label: "Upload", icon: Upload, match: (p: string) => p.startsWith("/upload") }]
      : []),
    ...(user
      ? [{ to: "/notifications", label: "Alerts", icon: Bell, match: (p: string) => p.startsWith("/notifications") }]
      : []),
    ...(isAdmin
      ? [{ to: "/admin", label: "Admin", icon: LayoutDashboard, match: (p: string) => p.startsWith("/admin") }]
      : []),
    { to: user ? "/me" : "/auth", label: user ? "Me" : "Sign in", icon: User, match: (p: string) => p.startsWith("/me") || p.startsWith("/auth") },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border glass pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <li key={it.label} className="flex-1">
              <Link
                to={it.to}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-2.5 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "scale-110")} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
