import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "./terms";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Vijana Brand" },
      { name: "description", content: "How Vijana Brand collects, uses and protects your personal data." },
      { property: "og:title", content: "Privacy Policy — Vijana Brand" },
      { property: "og:description", content: "How Vijana Brand collects, uses and protects your personal data." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage slug="privacy" />,
});
