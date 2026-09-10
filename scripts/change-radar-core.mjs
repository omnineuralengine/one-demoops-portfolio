import { createHash } from "node:crypto";

export const CHANGE_RADAR_USER_AGENT =
  "ONE-DemoOps-Change-Radar/0.1 (independent synthetic training artifact; read-only public-source monitor)";

export const DEFAULT_FETCH_OPTIONS = Object.freeze({
  concurrency: 3,
  timeoutMs: 12_000,
  retries: 2,
  maxRedirects: 5,
  maxBytes: 2_000_000,
});

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const REDIRECT_HTTP_STATUSES = new Set([301, 302, 303, 307, 308]);
const NOISE_ATTRIBUTE_WORDS = [
  "banner",
  "breadcrumb",
  "cookie",
  "consent",
  "footer",
  "language-picker",
  "modal",
  "navigation",
  "newsletter",
  "popover",
  "promo",
  "share-buttons",
  "sidebar",
  "subscribe",
];

const NAMED_HTML_ENTITIES = Object.freeze({
  amp: "&",
  apos: "'",
  copy: "©",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  reg: "®",
  rsquo: "’",
  trade: "™",
});

const LINE_NOISE_PATTERNS = [
  /^skip to (?:main )?content\.?$/i,
  /^open (?:main )?menu\.?$/i,
  /^close (?:main )?menu\.?$/i,
  /^cookie (?:preferences|settings|policy)\.?$/i,
  /^manage (?:cookie|privacy) (?:preferences|settings)\.?$/i,
  /^accept (?:all )?cookies\.?$/i,
  /^reject (?:all )?cookies\.?$/i,
  /^was this (?:article|page) helpful\??$/i,
  /^on this page$/i,
  /^table of contents$/i,
  /^back to top$/i,
  /^\d+ min(?:ute)? read$/i,
  /^last (?:checked|updated) (?:a|an|\d+) (?:seconds?|minutes?|hours?) ago$/i,
  /^©\s*\d{4}\s+(?:anthropic|salesforce).*$/i,
];

const KEYWORD_DOMAINS = [
  {
    domain: "identity and access",
    pattern: /\b(?:authentication|authorization|entitlement|identity|permission|rbac|scim|sso)\b/i,
  },
  {
    domain: "AI gateway",
    pattern: /\b(?:api|fallback|latency|rate limit|request|routing|token)\b/i,
  },
  {
    domain: "model governance",
    pattern: /\b(?:allowlist|deprecat|effort|model|policy|retire|sunset)\b/i,
  },
  {
    domain: "agent capabilities",
    pattern: /\b(?:agent|claude code|connector|plugin|skill|tool use)\b/i,
  },
  {
    domain: "tool interoperability",
    pattern: /\b(?:mcp|model context protocol|tool server)\b/i,
  },
  {
    domain: "safety controls",
    pattern: /\b(?:compliance|governance|privacy|safety|security|vulnerability)\b/i,
  },
  {
    domain: "service health",
    pattern: /\b(?:degrad|incident|latency|outage|resolved|service health)\b/i,
  },
  {
    domain: "partnership context",
    pattern: /\b(?:claudeforce|partnership|salesforce)\b/i,
  },
];

const HIGH_IMPACT_PATTERN =
  /\b(?:authentication|authorization|breaking|deprecat(?:e|ed|ion)|entitlement|incident|migration|required action|removed?|security|scim|sso|sunset|vulnerability)\b/i;
const MEDIUM_IMPACT_PATTERN =
  /\b(?:api|connector|effort|fallback|mcp|model|plugin|quota|rate limit|routing|skill|tool)\b/i;

export class SourceFetchError extends Error {
  constructor(message, { statusCode = null, retryable = false, retryAfterMs = 0, stage = "TRANSPORT_ERROR" } = {}) {
    super(message);
    this.name = "SourceFetchError";
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    this.stage = stage;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncate(value, maxLength) {
  const compact = String(value ?? "").replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function truncateToWordBudget(value, maxWords = 24, maxCharacters = 280) {
  const compact = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!compact) return null;

  const words = compact.split(" ");
  const withinWordBudget = words.slice(0, maxWords).join(" ");
  const wasWordTruncated = words.length > maxWords;
  const withinCharacterBudget = truncate(withinWordBudget, maxCharacters);
  const wasCharacterTruncated = withinCharacterBudget !== withinWordBudget;

  if ((wasWordTruncated || wasCharacterTruncated) && !withinCharacterBudget.endsWith("…")) {
    return truncate(`${withinCharacterBudget}…`, maxCharacters);
  }

  return withinCharacterBudget;
}

export function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);?/gi, (_, hexadecimal) => {
      const codePoint = Number.parseInt(hexadecimal, 16);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : " ";
    })
    .replace(/&#(\d+);?/g, (_, decimal) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : " ";
    })
    .replace(/&([a-z]+);/gi, (entity, name) => NAMED_HTML_ENTITIES[name.toLowerCase()] ?? entity);
}

function stripInlineMarkup(value) {
  return decodeHtmlEntities(
    String(value ?? "")
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function stripKnownHtmlNoise(value) {
  let html = String(value ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(?:script|style|noscript|svg|template|canvas|iframe)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg|template|canvas|iframe)>/gi, " ")
    .replace(/<(?:nav|footer|aside|dialog)\b[^>]*>[\s\S]*?<\/(?:nav|footer|aside|dialog)>/gi, " ");

  const noiseWords = NOISE_ATTRIBUTE_WORDS.map(escapeRegExp).join("|");
  const noisyContainer = new RegExp(
    `<([a-z][\\w:-]*)\\b(?=[^>]*(?:id|class|role|aria-label)\\s*=\\s*["'][^"']*(?:${noiseWords})[^"']*["'])[^>]*>[\\s\\S]*?<\\/\\1>`,
    "gi",
  );

  // A few bounded passes handle common nested cookie/sidebar wrappers without a DOM dependency.
  for (let pass = 0; pass < 3; pass += 1) {
    html = html.replace(noisyContainer, " ");
  }

  return html;
}

function normalizeComparableLines(value) {
  const lines = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t\f\v ]+/g, " ").trim())
    .map((line) => line.replace(/^(#{1,6})\s*/, "$1 "));

  const normalized = [];
  let previousLine = null;

  for (const line of lines) {
    if (line && LINE_NOISE_PATTERNS.some((pattern) => pattern.test(line))) continue;
    if (!line) {
      if (normalized.length > 0 && normalized.at(-1) !== "") normalized.push("");
      continue;
    }
    if (line === previousLine) continue;
    normalized.push(line);
    previousLine = line;
  }

  while (normalized.at(-1) === "") normalized.pop();
  return normalized.join("\n").trim();
}

export function normalizeHtml(value) {
  let html = stripKnownHtmlNoise(value);

  html = html
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) => {
      const heading = stripInlineMarkup(content);
      return heading ? `\n${"#".repeat(Number(level))} ${heading}\n` : "\n";
    })
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(?:li|p|div|section|article|main|header|tr|table|ul|ol|dl|dt|dd)>/gi, "\n")
    .replace(/<(?:br|hr)\b[^>]*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  // Some feeds and app shells double-encode visible entities.
  return normalizeComparableLines(decodeHtmlEntities(decodeHtmlEntities(html)));
}

export function normalizeMarkdown(value) {
  let markdown = String(value ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/^\s*!\[[^\]]*]\(https?:\/\/[^)]*(?:badge|shields\.io)[^)]*\)\s*$/gim, " ")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/^(\s*)([^\n]+)\n\s*(=+|-+)\s*$/gm, (_, indent, heading, underline) =>
      `${indent}${underline.startsWith("=") ? "#" : "##"} ${heading.trim()}`,
    )
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) =>
      `\n${"#".repeat(Number(level))} ${stripInlineMarkup(content)}\n`,
    )
    .replace(/!\[([^\]]*)]\([^)]*\)/g, (_, alternativeText) => alternativeText)
    .replace(/\[([^\]]+)]\((?:[^()]+|\([^)]*\))*\)/g, "$1")
    .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/gi, "$1")
    .replace(/^\s*```[^\n]*$/gm, "")
    .replace(/^\s*~~~[^\n]*$/gm, "")
    .replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[*+]\s+/gm, "- ")
    .replace(/<[^>]+>/g, " ");

  markdown = decodeHtmlEntities(decodeHtmlEntities(markdown));
  return normalizeComparableLines(markdown);
}

export function normalizeFeed(value) {
  const feed = String(value ?? "")
    .replace(/<lastBuildDate\b[^>]*>[\s\S]*?<\/lastBuildDate>/gi, " ")
    .replace(/<generator\b[^>]*>[\s\S]*?<\/generator>/gi, " ")
    .replace(/<atom:link\b(?=[^>]*\brel=["']self["'])[^>]*\/?>/gi, " ")
    .replace(/<title\b[^>]*>([\s\S]*?)<\/title>/gi, (_, content) =>
      `\n## ${stripInlineMarkup(content)}\n`,
    );

  return normalizeHtml(feed);
}

export function normalizeDocumentation(value, { format = "HTML" } = {}) {
  if (format === "MARKDOWN") return normalizeMarkdown(value);
  if (format === "ATOM" || format === "RSS") return normalizeFeed(value);
  return normalizeHtml(value);
}

export function isLikelyAccessControlInterstitial(value) {
  const sample = String(value ?? "").slice(0, 40_000);
  return (
    /<title[^>]*>\s*(?:access denied|attention required|just a moment|security check)/i.test(sample) ||
    /\b(?:cf-chl-|challenge-platform|g-recaptcha|hcaptcha)\b/i.test(sample) ||
    /\b(?:complete the security check|verify (?:that )?you are human)\b/i.test(sample)
  );
}

export function hashNormalizedContent(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

export function extractHeadingSections(value) {
  const lines = String(value ?? "").split("\n");
  const sections = [];
  const occurrences = new Map();
  let current = { heading: "Document body", level: 0, body: [] };

  const flush = () => {
    const body = current.body.join("\n").trim();
    if (!body && current.heading === "Document body" && sections.length === 0) return;

    const normalizedHeading = truncate(current.heading, 160) || "Document body";
    const occurrenceKey = normalizedHeading.toLocaleLowerCase("en-US");
    const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
    occurrences.set(occurrenceKey, occurrence);
    sections.push({
      heading: normalizedHeading,
      level: current.level,
      occurrence,
      body,
      hash: hashNormalizedContent(`${normalizedHeading}\n${body}`),
    });
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!headingMatch) {
      current.body.push(line);
      continue;
    }

    flush();
    current = {
      heading: headingMatch[2].replace(/\s+#+\s*$/, "").trim(),
      level: headingMatch[1].length,
      body: [],
    };
  }

  flush();
  if (sections.length === 0) {
    sections.push({
      heading: "Document body",
      level: 0,
      occurrence: 1,
      body: "",
      hash: hashNormalizedContent("Document body\n"),
    });
  }

  return sections;
}

export function buildHeadingDigests(value, limit = 60) {
  return extractHeadingSections(value)
    .slice(0, limit)
    .map(({ heading, occurrence, hash }) => ({ heading, occurrence, hash }));
}

function digestKey(section) {
  return `${section.heading.toLocaleLowerCase("en-US")}::${section.occurrence}`;
}

function minimalChangedExcerpt(previousText, currentText, nearestHeading) {
  const previousLines = String(previousText ?? "").split("\n");
  const currentLines = String(currentText ?? "").split("\n");
  let start = 0;

  while (
    start < previousLines.length &&
    start < currentLines.length &&
    previousLines[start] === currentLines[start]
  ) {
    start += 1;
  }

  let previousEnd = previousLines.length - 1;
  let currentEnd = currentLines.length - 1;
  while (
    previousEnd >= start &&
    currentEnd >= start &&
    previousLines[previousEnd] === currentLines[currentEnd]
  ) {
    previousEnd -= 1;
    currentEnd -= 1;
  }

  const currentDifference = currentLines
    .slice(start, currentEnd + 1)
    .filter((line) => line && !/^#{1,6}\s/.test(line))
    .join(" ");

  if (currentDifference) return truncateToWordBudget(`Observed: ${currentDifference}`);
  const location = nearestHeading && nearestHeading !== "Document body"
    ? ` near “${nearestHeading}”`
    : "";
  return truncateToWordBudget(`Content was removed${location}; open the official source to review.`);
}

export function compareNormalizedDocuments({
  previousText = null,
  currentText,
  previousHeadingDigests = [],
}) {
  const currentSections = extractHeadingSections(currentText);
  const previousSections = previousText
    ? extractHeadingSections(previousText)
    : previousHeadingDigests;
  const currentByKey = new Map(currentSections.map((section) => [digestKey(section), section]));
  const previousByKey = new Map(previousSections.map((section) => [digestKey(section), section]));
  const changedHeadings = [];

  for (const section of currentSections) {
    const previous = previousByKey.get(digestKey(section));
    if (!previous || previous.hash !== section.hash) changedHeadings.push(section.heading);
  }
  for (const section of previousSections) {
    if (!currentByKey.has(digestKey(section))) changedHeadings.push(section.heading);
  }

  const uniqueChangedHeadings = [...new Set(changedHeadings)].slice(0, 12);
  const excerpt = previousText
    ? minimalChangedExcerpt(previousText, currentText, uniqueChangedHeadings[0])
    : truncateToWordBudget(
        currentSections.find((section) =>
          uniqueChangedHeadings.includes(section.heading),
        )?.body || "A content change was detected; open the official source to review.",
      );

  return {
    changedHeadings:
      uniqueChangedHeadings.length > 0 ? uniqueChangedHeadings : ["Document body"],
    excerpt,
    observedHeadings: currentSections
      .map((section) => section.heading)
      .filter((heading) => heading !== "Document body")
      .slice(0, 40),
    headingDigests: currentSections.slice(0, 60).map(({ heading, occurrence, hash }) => ({
      heading,
      occurrence,
      hash,
    })),
  };
}

export function firstSeenDocumentSummary(currentText) {
  const sections = extractHeadingSections(currentText);
  const observedHeadings = sections
    .map((section) => section.heading)
    .filter((heading) => heading !== "Document body")
    .slice(0, 40);
  const firstMeaningfulBody = sections.find((section) => section.body)?.body ?? "";

  return {
    changedHeadings: observedHeadings.slice(0, 12),
    excerpt: truncateToWordBudget(firstMeaningfulBody),
    observedHeadings,
    headingDigests: sections.slice(0, 60).map(({ heading, occurrence, hash }) => ({
      heading,
      occurrence,
      hash,
    })),
  };
}

export function classifyImpact({ source, status, changedHeadings = [], excerpt = null }) {
  const evidence = `${changedHeadings.join(" ")} ${excerpt ?? ""}`;
  const domains = new Set(source.impactDomains ?? []);

  for (const { domain, pattern } of KEYWORD_DOMAINS) {
    if (pattern.test(evidence)) domains.add(domain);
  }

  let impactLevel = source.defaultImpactLevel ?? "REVIEW_REQUIRED";
  if (status === "UNAVAILABLE") {
    impactLevel = "REVIEW_REQUIRED";
  } else if (impactLevel !== "REVIEW_REQUIRED" && HIGH_IMPACT_PATTERN.test(evidence)) {
    impactLevel = "HIGH";
  } else if (impactLevel === "LOW" && MEDIUM_IMPACT_PATTERN.test(evidence)) {
    impactLevel = "MEDIUM";
  }

  return { impactLevel, detectedImpactDomains: [...domains] };
}

function parseRobotsGroups(value) {
  const groups = [];
  let current = { agents: [], rules: [] };

  const flush = () => {
    if (current.agents.length > 0) groups.push(current);
    current = { agents: [], rules: [] };
  };

  for (const rawLine of String(value ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.replace(/\s+#.*$/, "").trim();
    if (!line) {
      if (current.rules.length > 0) flush();
      continue;
    }

    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const content = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (current.rules.length > 0) flush();
      current.agents.push(content.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current.agents.length > 0) {
      current.rules.push({ directive: field, pattern: content });
    }
  }

  flush();
  return groups;
}

export function parseRobotsTxt(value, userAgentToken = "one-demoops-change-radar") {
  const token = userAgentToken.toLowerCase();
  const groups = parseRobotsGroups(value);
  const matchingGroups = groups.filter((group) =>
    group.agents.some((agent) => agent === "*" || token.includes(agent)),
  );
  const bestSpecificity = matchingGroups.reduce(
    (best, group) => Math.max(
      best,
      ...group.agents
        .filter((agent) => agent === "*" || token.includes(agent))
        .map((agent) => (agent === "*" ? 0 : agent.length)),
    ),
    -1,
  );

  return matchingGroups
    .filter((group) =>
      group.agents.some((agent) =>
        (agent === "*" ? 0 : agent.length) === bestSpecificity &&
        (agent === "*" || token.includes(agent)),
      ),
    )
    .flatMap((group) => group.rules);
}

function robotsRuleMatches(path, pattern) {
  if (!pattern) return false;
  const endAnchored = pattern.endsWith("$");
  const withoutEndAnchor = endAnchored ? pattern.slice(0, -1) : pattern;
  const expression = withoutEndAnchor
    .split("*")
    .map(escapeRegExp)
    .join(".*");
  return new RegExp(`^${expression}${endAnchored ? "$" : ""}`).test(path);
}

export function isPathAllowedByRobots(path, rules) {
  const matches = rules
    .filter((rule) => robotsRuleMatches(path, rule.pattern))
    .sort((left, right) => {
      const lengthDifference = right.pattern.replace(/\*|\$$/g, "").length -
        left.pattern.replace(/\*|\$$/g, "").length;
      if (lengthDifference !== 0) return lengthDifference;
      return left.directive === "allow" ? -1 : 1;
    });

  return matches.length === 0 || matches[0].directive === "allow";
}

function parseRetryAfter(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1_000, 0), 5_000);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return 0;
  return Math.min(Math.max(date - Date.now(), 0), 5_000);
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new SourceFetchError(`Timed out after ${timeoutMs} ms.`, { retryable: true });
    }
    throw new SourceFetchError("Network request failed.", { retryable: true });
  } finally {
    clearTimeout(timeout);
  }
}

function contentTypeMatchesFormat(format, contentType) {
  if (!contentType) return false;
  if (format === "HTML") return /(?:text\/html|application\/xhtml\+xml)/i.test(contentType);
  if (format === "MARKDOWN") return /(?:text\/plain|text\/markdown)/i.test(contentType);
  return /(?:application\/(?:atom\+xml|rss\+xml|xml)|text\/xml)/i.test(contentType);
}

async function readResponseBodyLimited(response, maxBytes, timeoutMs) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    if (response.body) {
      void response.body.cancel("Declared body exceeded Change Radar safety limit").catch(() => undefined);
    }
    throw new SourceFetchError(`Response exceeded the ${maxBytes}-byte safety limit.`);
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  let timeout;
  const timeoutFailure = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new SourceFetchError(`Response body timed out after ${timeoutMs} ms.`, { retryable: true }));
    }, timeoutMs);
  });

  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeoutFailure]);
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new SourceFetchError(`Response exceeded the ${maxBytes}-byte safety limit.`);
      }
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel("Response body rejected by Change Radar policy").catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function discardResponseBody(response) {
  if (response.body) {
    void response.body.cancel("Response rejected by Change Radar policy").catch(() => undefined);
  }
}

function ensureAllowedTarget(url, source) {
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new SourceFetchError("Refused a redirect to a non-HTTPS, credentialed, or non-default-port URL.");
  }

  const allowedHosts = new Set(
    [new URL(source.url).hostname, ...(source.allowedRedirectHosts ?? [])]
      .map((host) => host.toLowerCase()),
  );
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    throw new SourceFetchError(
      `Refused a redirect to non-allowlisted host ${url.hostname}.`,
    );
  }
  if (!Array.isArray(source.allowedPathPrefixes) || source.allowedPathPrefixes.length === 0) {
    throw new SourceFetchError("A non-empty source path allowlist is required.");
  }
  if (!source.allowedPathPrefixes.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
    throw new SourceFetchError(`Refused a request outside the source path allowlist: ${url.pathname}.`);
  }
}

async function loadRobotsRules(sourceUrl, source, options) {
  const origin = sourceUrl.origin;
  if (!options.robotsCache.has(origin)) {
    options.robotsCache.set(origin, (async () => {
      let currentUrl = new URL("/robots.txt", origin);

      for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
        ensureAllowedTarget(currentUrl, { ...source, allowedPathPrefixes: ["/robots.txt"] });
        const response = await fetchWithTimeout(
          options.fetchImpl,
          currentUrl,
          {
            redirect: "manual",
            headers: {
              Accept: "text/plain",
              "User-Agent": options.userAgent,
            },
          },
          options.timeoutMs,
        );

        if (REDIRECT_HTTP_STATUSES.has(response.status)) {
          const location = response.headers.get("location");
          if (!location) {
            discardResponseBody(response);
            throw new SourceFetchError("robots.txt redirect omitted Location.");
          }
          await discardResponseBody(response);
          currentUrl = new URL(location, currentUrl);
          continue;
        }
        if (response.status === 404 || response.status === 410) {
          await discardResponseBody(response);
          return [];
        }
        if (response.status === 401 || response.status === 403) {
          await discardResponseBody(response);
          return [{ directive: "disallow", pattern: "/" }];
        }
        if (!response.ok) {
          await discardResponseBody(response);
          throw new SourceFetchError(
            `robots.txt was unavailable with HTTP ${response.status}; refusing to crawl conservatively.`,
            { statusCode: response.status, retryable: RETRYABLE_HTTP_STATUSES.has(response.status) },
          );
        }

        const robotsContentType = response.headers.get("content-type");
        if (!contentTypeMatchesFormat("MARKDOWN", robotsContentType)) {
          await discardResponseBody(response);
          throw new SourceFetchError("robots.txt returned an unexpected content type; refusing to crawl conservatively.", {
            statusCode: response.status,
            stage: "PARSING_ERROR",
          });
        }
        const robotsText = await readResponseBodyLimited(response, 256_000, options.timeoutMs);
        return parseRobotsTxt(robotsText);
      }

      throw new SourceFetchError("robots.txt exceeded the redirect limit.");
    })());
  }

  return options.robotsCache.get(origin);
}

async function assertRobotsAllows(url, source, options) {
  const rules = await loadRobotsRules(url, source, options);
  const path = `${url.pathname}${url.search}`;
  if (!isPathAllowedByRobots(path, rules)) {
    throw new SourceFetchError(`robots.txt disallows ${url.pathname}; source was not fetched.`);
  }
}

async function fetchSourceOnce(source, previousHttpMetadata, options) {
  let currentUrl = new URL(source.url);
  let redirectCount = 0;
  const headers = {
    Accept:
      source.format === "MARKDOWN"
        ? "text/markdown,text/plain;q=0.9,*/*;q=0.1"
        : source.format === "ATOM" || source.format === "RSS"
          ? "application/atom+xml,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.1"
          : "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    "Accept-Language": "en-US,en;q=0.8",
    "User-Agent": options.userAgent,
  };

  if (previousHttpMetadata?.etag) headers["If-None-Match"] = previousHttpMetadata.etag;
  if (previousHttpMetadata?.lastModified) {
    headers["If-Modified-Since"] = previousHttpMetadata.lastModified;
  }

  while (redirectCount <= options.maxRedirects) {
    ensureAllowedTarget(currentUrl, source);
    await assertRobotsAllows(currentUrl, source, options);
    const response = await fetchWithTimeout(
      options.fetchImpl,
      currentUrl,
      { headers, redirect: "manual" },
      options.timeoutMs,
    );

    if (REDIRECT_HTTP_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        discardResponseBody(response);
        throw new SourceFetchError(`HTTP ${response.status} redirect omitted Location.`);
      }
      await discardResponseBody(response);
      currentUrl = new URL(location, currentUrl);
      redirectCount += 1;
      continue;
    }

    const metadata = {
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      finalUrl: currentUrl.href,
      statusCode: response.status,
      redirectCount,
      contentType: response.headers.get("content-type"),
    };

    if (response.status === 304) return { notModified: true, body: null, metadata };
    if (!response.ok) {
      await discardResponseBody(response);
      throw new SourceFetchError(`Source returned HTTP ${response.status}.`, {
        statusCode: response.status,
        retryable: RETRYABLE_HTTP_STATUSES.has(response.status),
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
      });
    }

    if (!contentTypeMatchesFormat(source.format, metadata.contentType)) {
      await discardResponseBody(response);
      throw new SourceFetchError(`Source returned an unexpected content type for ${source.format}.`, {
        statusCode: response.status,
        stage: "PARSING_ERROR",
      });
    }

    return {
      notModified: false,
      body: await readResponseBodyLimited(response, options.maxBytes, options.timeoutMs),
      metadata,
    };
  }

  throw new SourceFetchError(`Source exceeded ${options.maxRedirects} redirects.`);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchDocumentationSource(
  source,
  previousHttpMetadata = null,
  overrides = {},
) {
  const options = {
    ...DEFAULT_FETCH_OPTIONS,
    ...overrides,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    robotsCache: overrides.robotsCache ?? new Map(),
    userAgent: overrides.userAgent ?? CHANGE_RADAR_USER_AGENT,
  };

  if (typeof options.fetchImpl !== "function") {
    throw new SourceFetchError("This Node runtime does not provide fetch().");
  }

  let lastError;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      return await fetchSourceOnce(source, previousHttpMetadata, options);
    } catch (error) {
      lastError = error instanceof SourceFetchError
        ? error
        : new SourceFetchError("Unexpected source fetch failure.");
      if (!lastError.retryable || attempt >= options.retries) throw lastError;
      const backoff = Math.max(lastError.retryAfterMs, Math.min(250 * (2 ** attempt), 2_000));
      await wait(backoff);
    }
  }

  throw lastError;
}

export function publicAvailabilityReason(error) {
  if (error instanceof SourceFetchError) return truncate(error.message, 180);
  return "Source was unavailable for an unexpected reason.";
}

export async function processWithConcurrency(items, limit, worker) {
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function consume() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: boundedLimit }, () => consume()));
  return results;
}
