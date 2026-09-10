import type { ChangeRadarSource, ChangeRadarSourceRegistry } from "../../lib/change-radar/types.ts";

const SOURCE_LIFECYCLES = new Set(["DISCOVERY_INDEX", "APPROVED_MONITOR", "CANDIDATE", "REFERENCE_ONLY", "RETIRED"]);
const SOURCE_KINDS = new Set(["DOCUMENTATION", "RELEASE_NOTES", "STATUS", "NEWS", "PARTNERSHIP"]);
const CONTENT_TYPES = new Set(["HTML", "MARKDOWN", "ATOM", "RSS"]);
const TRUST_LEVELS = new Set(["OFFICIAL_PRIMARY", "OFFICIAL_PARTNER"]);

const platform = (id: string, title: string, path: string, domains: readonly string[], priority: 1 | 2 | 3 = 2, lifecycle: ChangeRadarSource["lifecycle"] = "CANDIDATE"): ChangeRadarSource => ({ id, title, canonicalUrl: `https://platform.claude.com${path}`, lifecycle, sourceKind: path.includes("release-notes") ? "RELEASE_NOTES" : "DOCUMENTATION", expectedContentType: path.endsWith("llms.txt") ? "MARKDOWN" : "HTML", exactHosts: ["platform.claude.com"], allowedPathPrefixes: path.endsWith("llms.txt") ? [path, "/docs/en"] : [path], productSurface: "Claude Platform", operationalDomains: domains, priority, maxResponseBytes: 1_000_000, expectedOwner: "demo-systems-administrator", trustLevel: "OFFICIAL_PRIMARY", purpose: title });
const code = (id: string, title: string, path: string, domains: readonly string[], priority: 1 | 2 | 3 = 2, lifecycle: ChangeRadarSource["lifecycle"] = "CANDIDATE"): ChangeRadarSource => ({ id, title, canonicalUrl: `https://code.claude.com${path}`, lifecycle, sourceKind: path.includes("changelog") || path.includes("whats-new") ? "RELEASE_NOTES" : "DOCUMENTATION", expectedContentType: path.endsWith("llms.txt") ? "MARKDOWN" : "HTML", exactHosts: ["code.claude.com"], allowedPathPrefixes: path.endsWith("llms.txt") ? [path, "/docs/en"] : [path], productSurface: "Claude Code", operationalDomains: domains, priority, maxResponseBytes: 1_000_000, expectedOwner: "developer-experience-owner", trustLevel: "OFFICIAL_PRIMARY", purpose: title });

const sources: readonly ChangeRadarSource[] = [
  platform("platform-index", "Claude Platform documentation index", "/llms.txt", ["discovery"], 3, "DISCOVERY_INDEX"),
  code("code-index", "Claude Code documentation index", "/docs/llms.txt", ["discovery"], 3, "DISCOVERY_INDEX"),
  platform("platform-release-notes", "Claude Platform release notes", "/docs/en/release-notes/overview", ["model governance", "AI gateway"], 1, "APPROVED_MONITOR"),
  platform("models-overview", "Models overview", "/docs/en/about-claude/models/overview", ["model governance"], 1),
  platform("model-deprecations", "Model deprecations", "/docs/en/about-claude/model-deprecations", ["migration", "model governance"], 1),
  platform("admin-api", "Admin API", "/docs/en/build-with-claude/administration/administration-api", ["enterprise administration"], 1),
  platform("user-management", "User management", "/docs/en/build-with-claude/administration/user-management-api", ["identity and access"], 1),
  platform("workspaces", "Workspaces", "/docs/en/build-with-claude/administration/workspaces", ["workspace governance"]),
  platform("authentication", "API authentication", "/docs/en/api/getting-started", ["identity and access"], 1),
  platform("wif", "Workload Identity Federation", "/docs/en/build-with-claude/administration/workload-identity-federation", ["identity and access"], 1),
  platform("rate-limits", "Rate limits", "/docs/en/api/rate-limits", ["AI gateway"], 1),
  platform("usage-cost", "Usage and cost API", "/docs/en/build-with-claude/administration/usage-cost-api", ["observability"]),
  platform("analytics", "Analytics API", "/docs/en/build-with-claude/administration/analytics-api", ["observability"]),
  platform("compliance", "Compliance API", "/docs/en/build-with-claude/administration/compliance-api", ["safety controls"]),
  platform("managed-agents", "Managed Agents", "/docs/en/agents-and-tools/managed-agents", ["agent capabilities"]),
  platform("tool-use", "Tool use", "/docs/en/agents-and-tools/tool-use/overview", ["agent capabilities"], 1),
  platform("strict-tools", "Strict tool use", "/docs/en/agents-and-tools/tool-use/implement-tool-use", ["agent capabilities"]),
  platform("mcp-connectors", "MCP connector", "/docs/en/agents-and-tools/mcp-connector", ["tool interoperability"], 1),
  code("code-whats-new", "Claude Code what's new", "/docs/en/whats-new", ["operator tooling"]),
  code("code-changelog", "Claude Code changelog", "/docs/en/changelog", ["operator tooling"], 1, "APPROVED_MONITOR"),
  code("code-agents", "Claude Code subagents", "/docs/en/sub-agents", ["agent capabilities"]),
  code("code-permissions", "Claude Code permissions", "/docs/en/permissions", ["identity and access"], 1),
  code("code-hooks", "Claude Code hooks", "/docs/en/hooks", ["event handling"]),
  code("code-costs", "Claude Code costs", "/docs/en/costs", ["session budgets"]),
  code("code-skills", "Claude Code skills", "/docs/en/skills", ["agent capabilities"]),
  { id: "apps-release-notes", title: "Claude Apps release notes", canonicalUrl: "https://support.claude.com/en/articles/12138966-release-notes", lifecycle: "APPROVED_MONITOR", sourceKind: "RELEASE_NOTES", expectedContentType: "HTML", exactHosts: ["support.claude.com"], allowedPathPrefixes: ["/en/articles/12138966-release-notes"], productSurface: "Claude Apps", operationalDomains: ["enterprise administration", "demo readiness"], priority: 1, maxResponseBytes: 1_000_000, expectedOwner: "demo-systems-administrator", trustLevel: "OFFICIAL_PRIMARY", purpose: "Track user-visible Claude Apps changes." },
  { id: "anthropic-news", title: "Anthropic news", canonicalUrl: "https://www.anthropic.com/news", lifecycle: "APPROVED_MONITOR", sourceKind: "NEWS", expectedContentType: "HTML", exactHosts: ["www.anthropic.com", "anthropic.com"], allowedPathPrefixes: ["/news"], productSurface: "Anthropic news", operationalDomains: ["external intelligence"], priority: 3, maxResponseBytes: 1_000_000, expectedOwner: "change-intelligence-owner", trustLevel: "OFFICIAL_PRIMARY", purpose: "Track official company announcements." },
  { id: "status-atom", title: "Claude status history", canonicalUrl: "https://status.claude.com/history.atom", lifecycle: "APPROVED_MONITOR", sourceKind: "STATUS", expectedContentType: "ATOM", exactHosts: ["status.claude.com"], allowedPathPrefixes: ["/history.atom"], productSurface: "Claude service health", operationalDomains: ["service health", "demo readiness"], priority: 1, maxResponseBytes: 500_000, expectedOwner: "service-reliability-owner", trustLevel: "OFFICIAL_PRIMARY", purpose: "Track official public service-health events." },
  { id: "claudeforce", title: "Salesforce and Anthropic announce Claudeforce", canonicalUrl: "https://www.salesforce.com/news/press-releases/2026/08/26/salesforce-and-anthropic-announce-claudeforce/", lifecycle: "REFERENCE_ONLY", sourceKind: "PARTNERSHIP", expectedContentType: "HTML", exactHosts: ["www.salesforce.com", "salesforce.com"], allowedPathPrefixes: ["/news/press-releases/2026/08/26/salesforce-and-anthropic-announce-claudeforce/"], productSurface: "Official ecosystem partnership", operationalDomains: ["partnership context", "connectors"], priority: 3, maxResponseBytes: 1_000_000, expectedOwner: "partnership-readiness-owner", trustLevel: "OFFICIAL_PARTNER", purpose: "Static official partnership evidence retained as a reference, not a recurring monitor." },
];

export function isSourceUrlAllowed(source: ChangeRadarSource, candidate: string): boolean {
  let url: URL; try { url = new URL(candidate); } catch { return false; }
  return url.protocol === "https:" && !url.username && !url.password && !url.port && source.exactHosts.includes(url.hostname.toLowerCase()) && source.allowedPathPrefixes.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
}

export function parseChangeRadarRegistry(value: unknown): ChangeRadarSourceRegistry {
  if (!value || typeof value !== "object") throw new Error("Change Radar registry must be an object.");
  const candidate = value as { schemaVersion?: unknown; description?: unknown; sources?: unknown };
  if (candidate.schemaVersion !== 3 || typeof candidate.description !== "string" || !candidate.description.trim() || !Array.isArray(candidate.sources)) {
    throw new Error("Change Radar registry must contain a v3 description and sources.");
  }

  const ids = new Set<string>();
  const urls = new Set<string>();
  const parsedSources: ChangeRadarSource[] = [];
  for (const rawSource of candidate.sources) {
    if (!rawSource || typeof rawSource !== "object" || Array.isArray(rawSource)) throw new Error("Every Change Radar source must be an object.");
    const source = rawSource as ChangeRadarSource;
    if (typeof source.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(source.id) || ids.has(source.id)) throw new Error(`Invalid or duplicate source id: ${String(source.id)}`);
    if (typeof source.canonicalUrl !== "string" || urls.has(source.canonicalUrl)) throw new Error(`Invalid or duplicate source URL: ${String(source.canonicalUrl)}`);
    if (!SOURCE_LIFECYCLES.has(source.lifecycle) || !SOURCE_KINDS.has(source.sourceKind) || !CONTENT_TYPES.has(source.expectedContentType) || !TRUST_LEVELS.has(source.trustLevel)) throw new Error(`Invalid governance enum for source: ${source.id}`);
    if (!Array.isArray(source.exactHosts) || source.exactHosts.length === 0 || source.exactHosts.some((host) => typeof host !== "string" || host !== host.toLowerCase() || !host.trim())) throw new Error(`Invalid host allowlist for source: ${source.id}`);
    if (!Array.isArray(source.allowedPathPrefixes) || source.allowedPathPrefixes.length === 0 || source.allowedPathPrefixes.some((path) => typeof path !== "string" || !path.startsWith("/") || path.includes(".."))) throw new Error(`Invalid path allowlist for source: ${source.id}`);
    if (!Array.isArray(source.operationalDomains) || source.operationalDomains.length === 0 || source.operationalDomains.some((domain) => typeof domain !== "string" || !domain.trim())) throw new Error(`Invalid operational domains for source: ${source.id}`);
    if (![1, 2, 3].includes(source.priority) || !Number.isInteger(source.maxResponseBytes) || source.maxResponseBytes < 1 || source.maxResponseBytes > 2_000_000) throw new Error(`Invalid bounds for source: ${source.id}`);
    if (typeof source.productSurface !== "string" || !source.productSurface.trim() || typeof source.expectedOwner !== "string" || !source.expectedOwner.trim() || typeof source.purpose !== "string" || !source.purpose.trim()) throw new Error(`Incomplete governance for source: ${source.id}`);
    if (!isSourceUrlAllowed(source, source.canonicalUrl)) throw new Error(`Source URL is outside its own allowlist: ${source.canonicalUrl}`);
    ids.add(source.id);
    urls.add(source.canonicalUrl);
    parsedSources.push(Object.freeze({ ...source, exactHosts: Object.freeze([...source.exactHosts]), allowedPathPrefixes: Object.freeze([...source.allowedPathPrefixes]), operationalDomains: Object.freeze([...source.operationalDomains]) }));
  }
  return Object.freeze({ schemaVersion: 3, description: candidate.description, sources: Object.freeze(parsedSources) });
}

export const CHANGE_RADAR_SOURCE_REGISTRY = parseChangeRadarRegistry({ schemaVersion: 3 as const, description: "Governed official-source lifecycle registry.", sources });
export const CHANGE_RADAR_SOURCES = CHANGE_RADAR_SOURCE_REGISTRY.sources;
