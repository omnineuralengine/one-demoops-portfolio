export interface HeadingDigest {
  heading: string;
  occurrence: number;
  hash: string;
}
export interface HeadingSection extends HeadingDigest { level: number; body: string }
export declare const DEFAULT_FETCH_OPTIONS: Readonly<{ timeoutMs: number; retries: number; maxRedirects: number; maxBytes: number; concurrency: number }>;
export class SourceFetchError extends Error { code: string; statusCode: number | null; stage: "TRANSPORT_ERROR" | "PARSING_ERROR" }
export function truncateToWordBudget(value: string, maxWords?: number, maxCharacters?: number): string;

export interface NormalizedComparison {
  changedHeadings: string[];
  excerpt: string | null;
  observedHeadings: string[];
  headingDigests: HeadingDigest[];
}

export interface FetchableDocumentationSource {
  id: string;
  url: string;
  format: "HTML" | "MARKDOWN" | "ATOM" | "RSS";
  allowedRedirectHosts: string[];
  allowedPathPrefixes: string[];
}

export interface DocumentationFetchResult {
  notModified: boolean;
  body: string | null;
  metadata: {
    etag: string | null;
    lastModified: string | null;
    finalUrl: string;
    statusCode: number;
    redirectCount: number;
    contentType: string | null;
  };
}

export function normalizeHtml(value: string): string;
export function normalizeMarkdown(value: string): string;
export function normalizeFeed(value: string): string;
export function normalizeDocumentation(value: string, options?: { format?: "HTML" | "MARKDOWN" | "ATOM" | "RSS" }): string;
export function isLikelyAccessControlInterstitial(value: string): boolean;
export function hashNormalizedContent(value: string): string;
export function extractHeadingSections(value: string): HeadingSection[];
export function buildHeadingDigests(value: string, limit?: number): HeadingDigest[];
export function compareNormalizedDocuments(options: {
  previousText?: string | null;
  currentText: string;
  previousHeadingDigests?: HeadingDigest[];
}): NormalizedComparison;
export function parseRobotsTxt(
  value: string,
  userAgentToken?: string,
): Array<{ directive: "allow" | "disallow"; pattern: string }>;
export function isPathAllowedByRobots(
  path: string,
  rules: Array<{ directive: "allow" | "disallow"; pattern: string }>,
): boolean;
export function fetchDocumentationSource(
  source: FetchableDocumentationSource,
  previousHttpMetadata?: { etag?: string | null; lastModified?: string | null } | null,
  options?: {
    timeoutMs?: number;
    retries?: number;
    maxRedirects?: number;
    maxBytes?: number;
    fetchImpl?: typeof fetch;
    robotsCache?: Map<string, Promise<Array<{ directive: "allow" | "disallow"; pattern: string }>>>;
    userAgent?: string;
  },
): Promise<DocumentationFetchResult>;
export function processWithConcurrency<T, R>(items: readonly T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]>;
