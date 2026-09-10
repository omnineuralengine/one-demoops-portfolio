import type { ChangeRadarSource } from "../../lib/change-radar/types.ts";
import { isSourceUrlAllowed } from "../../data/change-radar/registry.ts";
import { fetchDocumentationSource, processWithConcurrency, SourceFetchError, DEFAULT_FETCH_OPTIONS } from "../change-radar-core.mjs";
export { processWithConcurrency, SourceFetchError, DEFAULT_FETCH_OPTIONS };
export async function fetchRadarSource(source: ChangeRadarSource, previous: { etag?: string | null; lastModified?: string | null } | null = null, options: { fetchImpl?: typeof fetch; timeoutMs?: number; retries?: number; maxRedirects?: number; robotsCache?: Map<string, Promise<Array<{ directive: "allow" | "disallow"; pattern: string }>>> } = {}) {
  if (!isSourceUrlAllowed(source, source.canonicalUrl)) throw new SourceFetchError("Source URL is outside its exact host and path allowlist.");
  return fetchDocumentationSource({ id: source.id, url: source.canonicalUrl, format: source.expectedContentType, allowedRedirectHosts: [...source.exactHosts], allowedPathPrefixes: [...source.allowedPathPrefixes] }, previous, { ...options, maxBytes: source.maxResponseBytes });
}
