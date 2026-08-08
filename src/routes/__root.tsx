import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/use-auth";
import { PlayerProvider } from "@/hooks/use-player";
import { ThemeProvider } from "@/hooks/use-theme";
import { OfflineProvider } from "@/hooks/use-offline";

import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { FloatingPlayer } from "@/components/player/floating-player";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-background px-4 text-center">
      <div className="text-8xl font-black text-gradient">404</div>
      <h1 className="mt-4 text-2xl font-bold">This track wasn't found</h1>
      <p className="mt-2 text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-full bg-gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
      >
        Back to home
      </Link>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Something went off-key</h1>
        <p className="mt-2 text-sm text-muted-foreground">We hit an error loading this page.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Try again
          </button>
          <a href="/" className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold hover:bg-secondary">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1a1520" },
      { title: "Vijana Brand — Discover new music from independent artists" },
      {
        name: "description",
        content:
          "Stream, download and share songs from independent African artists. Free to listen, easy to upload, mobile-first.",
      },
      { name: "author", content: "Vijana Brand" },
      { property: "og:title", content: "Vijana Brand — Discover new music from independent artists" },
      { property: "og:description", content: "Stream, download and share songs from independent African artists. Free to listen, easy to upload, mobile-first." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Vijana Brand — Discover new music from independent artists" },
      { name: "twitter:description", content: "Stream, download and share songs from independent African artists. Free to listen, easy to upload, mobile-first." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f86de1a1-37af-4a51-81df-06347ebc7909/id-preview-ed10b204--c54a1378-74c4-4df9-ae5e-83310dac30b8.lovable.app-1784485836220.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f86de1a1-37af-4a51-81df-06347ebc7909/id-preview-ed10b204--c54a1378-74c4-4df9-ae5e-83310dac30b8.lovable.app-1784485836220.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <OfflineProvider>
            <PlayerProvider>
              <div className="min-h-screen bg-background text-foreground">
                <TopBar />
                <main className="pb-40 md:pb-32">
                  <Outlet />
                </main>
                <BottomNav />
                <FloatingPlayer />
              </div>
              <Toaster position="top-center" richColors />
            </PlayerProvider>
          </OfflineProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>

  );
}
