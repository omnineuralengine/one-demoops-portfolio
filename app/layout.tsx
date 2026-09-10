import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { GitBranch } from "lucide-react";
import { shouldEnableHostedAnalytics } from "@/lib/runtime-boundaries";
import "./globals.css";

const allowIndexing = process.env.ONE_ALLOW_INDEXING === "true";
const vercelHostname =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
const metadataBase = new URL(
  vercelHostname ? `https://${vercelHostname}` : "http://localhost:3000",
);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "ONE DemoOps Control Plane",
    template: "%s | ONE DemoOps Control Plane",
  },
  description:
    "Follow a public-source change through inferred impact, human ownership, and simulated verification in an independent synthetic DemoOps lab.",
  applicationName: "ONE DemoOps Control Plane",
  authors: [{ name: "Omni Neural Engine" }],
  category: "technology",
  robots: {
    index: allowIndexing,
    follow: allowIndexing,
    nocache: !allowIndexing,
  },
  openGraph: {
    type: "website",
    title: "ONE DemoOps Control Plane — Independent Synthetic Lab",
    description:
      "Fictional data, governed agents, explainable routing, and public-documentation change intelligence. Not affiliated with Anthropic.",
    siteName: "Built with ONE",
  },
  twitter: {
    card: "summary_large_image",
    title: "ONE DemoOps Control Plane — Independent Synthetic Lab",
    description:
      "A human-centered systems portfolio using fictional data and public concepts.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0e12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <header className="site-header">
          <Link className="brand" href="/briefing" aria-label="ONE DemoOps briefing">
            <span className="brand-mark" aria-hidden="true">
              <GitBranch size={17} strokeWidth={2.4} />
            </span>
            <span>
              <strong>ONE</strong>
              <small>DemoOps Control Plane</small>
            </span>
          </Link>
          <nav className="site-nav" aria-label="Primary">
            <Link href="/briefing">Briefing</Link>
            <Link href="/lab">Open control plane</Link>
            <Link href="/about">How I built this</Link>
          </nav>
        </header>
        <main id="main-content">{children}</main>
        <footer className="site-footer">
          <div>
            <strong>Built with ONE</strong>
            <span>Understand the change. Own the response.</span>
          </div>
          <p>
            Independent, synthetic demonstration built from publicly available information.
            Not affiliated with Anthropic and not representative of Anthropic’s internal systems
            or architecture.
          </p>
        </footer>
        {shouldEnableHostedAnalytics(process.env) ? <Analytics /> : null}
      </body>
    </html>
  );
}
