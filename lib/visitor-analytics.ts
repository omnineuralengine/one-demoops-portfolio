import type { BeforeSendEvent } from "@vercel/analytics/next";

/** Visitor counts are separate from the lab's in-memory simulated telemetry. */
export function filterVisitorPageview(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview" || typeof navigator === "undefined" || navigator.webdriver) {
    return null;
  }

  try {
    // The SDK sends the incoming referrer outside beforeSend's URL field.
    if (typeof document !== "undefined" && document.referrer) {
      const referrer = new URL(document.referrer);
      if (referrer.search || referrer.hash || referrer.username || referrer.password) return null;
    }
    const url = new URL(event.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // Only origin and path leave the browser; discard query, fragment and user info.
    return { type: "pageview", url: `${url.origin}${url.pathname}` };
  } catch {
    return null;
  }
}
