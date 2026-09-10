"use client";

import { Analytics } from "@vercel/analytics/next";
import { filterVisitorPageview } from "@/lib/visitor-analytics";

export function HostedAnalytics() {
  return <Analytics beforeSend={filterVisitorPageview} />;
}
