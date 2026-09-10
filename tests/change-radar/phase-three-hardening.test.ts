import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CHANGE_RADAR_SOURCE_REGISTRY } from "../../data/change-radar/registry";
import {
  parseComparisonArtifact,
  parseHistoryArtifact,
  parseLatestArtifact,
  parsePublicChangeEvent,
  parseSourceHealthArtifact,
} from "../../lib/change-radar/schema";
import type { FetchableDocumentationSource } from "../../scripts/change-radar-core.mjs";
import { fetchDocumentationSource } from "../../scripts/change-radar-core.mjs";
import { discoverDetailed } from "../../scripts/change-radar/discover";
import { retainBoundedHistory } from "../../scripts/change-radar/emit";
import { runRadar, writeRadarArtifacts } from "../../scripts/change-radar/orchestrator";
import { sectionize } from "../../scripts/change-radar/sectionize";

const roots: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

const SOURCE: FetchableDocumentationSource = {
  id: "fixture",
  url: "https://docs.example.test/releases",
  format: "MARKDOWN",
  allowedRedirectHosts: ["docs.example.test"],
  allowedPathPrefixes: ["/releases"],
};

const robotsAllowed = () => new Response("User-agent: *\nAllow: /", { status: 200 });
const documentResponse = () => new Response("# Release notes\nA sufficiently long deterministic documentation response for validation.", {
  headers: { "content-type": "text/markdown" },
});

describe("hardened transport policy", () => {
  it("aborts requests at the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      if (String(input).endsWith("robots.txt")) return Promise.resolve(robotsAllowed());
      return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    });
    const request = fetchDocumentationSource(SOURCE, null, { fetchImpl, retries: 0, timeoutMs: 10 });
    const rejection = expect(request).rejects.toThrow("Timed out");
    await vi.advanceTimersByTimeAsync(11);
    await rejection;
  });

  it.each([
    ["a different host", "https://evil.example/releases", "non-allowlisted host"],
    ["a different path", "https://docs.example.test/private", "path allowlist"],
    ["a non-default port", "https://docs.example.test:8443/releases", "non-default-port"],
  ])("rejects redirects to %s", async (_label, location, message) => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => String(input).endsWith("robots.txt")
      ? robotsAllowed()
      : new Response(null, { status: 302, headers: { location } }));
    await expect(fetchDocumentationSource(SOURCE, null, { fetchImpl, retries: 0 })).rejects.toThrow(message);
  });

  it("bounds redirect loops and hop counts", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => String(input).endsWith("robots.txt")
      ? robotsAllowed()
      : new Response(null, { status: 302, headers: { location: "/releases/again" } }));
    await expect(fetchDocumentationSource(SOURCE, null, { fetchImpl, retries: 0, maxRedirects: 2 })).rejects.toThrow("exceeded 2 redirects");
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("rejects declared and streamed oversized bodies", async () => {
    const declared = vi.fn<typeof fetch>(async (input) => String(input).endsWith("robots.txt")
      ? robotsAllowed()
      : new Response("small", { headers: { "content-length": "1000" } }));
    await expect(fetchDocumentationSource(SOURCE, null, { fetchImpl: declared, retries: 0, maxBytes: 10 })).rejects.toThrow("safety limit");

    const streamed = vi.fn<typeof fetch>(async (input) => String(input).endsWith("robots.txt")
      ? robotsAllowed()
      : new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(8)); controller.enqueue(new Uint8Array(8)); controller.close(); } }), { headers: { "content-type": "text/plain" } }));
    await expect(fetchDocumentationSource(SOURCE, null, { fetchImpl: streamed, retries: 0, maxBytes: 10 })).rejects.toThrow("safety limit");
  });

  it("times out a stalled streamed body", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(async (input) => String(input).endsWith("robots.txt")
      ? robotsAllowed()
      : new Response(new ReadableStream({ start() {} }), { headers: { "content-type": "text/plain" } }));
    const request = fetchDocumentationSource(SOURCE, null, { fetchImpl, retries: 0, timeoutMs: 10 });
    const rejection = expect(request).rejects.toThrow("Response body timed out");
    await vi.advanceTimersByTimeAsync(11);
    await rejection;
  });

  it("rejects missing source content types and non-text robots responses", async () => {
    const missingType = vi.fn<typeof fetch>(async (input) => String(input).endsWith("robots.txt")
      ? robotsAllowed()
      : new Response(new Uint8Array([65, 66, 67])));
    await expect(fetchDocumentationSource(SOURCE, null, { fetchImpl: missingType, retries: 0 })).rejects.toThrow("unexpected content type");

    const htmlRobots = vi.fn<typeof fetch>(async () => new Response("<html>challenge</html>", {
      headers: { "content-type": "text/html" },
    }));
    await expect(fetchDocumentationSource(SOURCE, null, { fetchImpl: htmlRobots, retries: 0 })).rejects.toThrow(/robots\.txt returned an unexpected content type/);
    expect(htmlRobots).toHaveBeenCalledTimes(1);
  });

  it("cancels rejected response bodies before failing closed", async () => {
    let cancelled = 0;
    const rejectedBody = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled += 1;
      },
    });
    const fetchImpl = vi.fn<typeof fetch>(async (input) => String(input).endsWith("robots.txt")
      ? robotsAllowed()
      : new Response(rejectedBody, { headers: { "content-type": "application/json" } }));

    await expect(fetchDocumentationSource(SOURCE, null, { fetchImpl, retries: 0 })).rejects.toThrow("unexpected content type");
    expect(cancelled).toBe(1);
  });

  it.each(["robots", "source"] as const)("cancels a %s redirect body when Location is missing", async (stage) => {
    let cancelled = 0;
    const missingLocation = () => new Response(new ReadableStream<Uint8Array>({
      cancel() {
        cancelled += 1;
      },
    }), { status: 302 });
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const isRobots = String(input).endsWith("robots.txt");
      if ((stage === "robots" && isRobots) || (stage === "source" && !isRobots)) {
        return missingLocation();
      }
      return robotsAllowed();
    });

    await expect(fetchDocumentationSource(SOURCE, null, { fetchImpl, retries: 0 })).rejects.toThrow("redirect omitted Location");
    expect(cancelled).toBe(1);
  });

  it("bounds HTTP 429 retries", async () => {
    let sourceCalls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).endsWith("robots.txt")) return robotsAllowed();
      sourceCalls += 1;
      return new Response("rate limited", { status: 429, headers: { "retry-after": "0" } });
    });
    await expect(fetchDocumentationSource(SOURCE, null, { fetchImpl, retries: 2 })).rejects.toThrow("HTTP 429");
    expect(sourceCalls).toBe(3);
  });

  it("fails closed for robots denial and robots errors", async () => {
    for (const response of [new Response("User-agent: *\nDisallow: /", { status: 200 }), new Response("error", { status: 503 })]) {
      const fetchImpl = vi.fn<typeof fetch>(async () => response.clone());
      await expect(fetchDocumentationSource(SOURCE, null, { fetchImpl, retries: 0 })).rejects.toThrow(/robots\.txt/);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });
});

describe("domain isolation and lifecycle", () => {
  it("classifies content-type and semantic failures without stopping healthy sources", async () => {
    const approved = CHANGE_RADAR_SOURCE_REGISTRY.sources.filter((source) => source.lifecycle === "APPROVED_MONITOR");
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("robots.txt")) return robotsAllowed();
      if (url.includes("support.claude.com")) return new Response("{}", { headers: { "content-type": "application/json" } });
      if (url.includes("anthropic.com/news")) return new Response("<title>Just a moment...</title><div id='cf-chl-widget'>Checking</div>", { headers: { "content-type": "text/html" } });
      if (url.endsWith(".atom")) return new Response("<feed><title>Stable service status content with adequate semantic length</title></feed>", { headers: { "content-type": "application/atom+xml" } });
      return new Response("<main><h1>Stable docs</h1><p>A healthy official source with adequate semantic content.</p></main>", { headers: { "content-type": "text/html" } });
    });
    const result = await runRadar({ fetchImpl, now: () => new Date("2026-09-02T00:00:00Z") });
    expect(result.health).toHaveLength(approved.length);
    expect(result.health.some(({ stage }) => stage === "PARSING_ERROR")).toBe(true);
    expect(result.health.some(({ stage }) => stage === "SEMANTIC_ERROR")).toBe(true);
    expect(result.health.some(({ stage }) => stage === "HEALTHY")).toBe(true);
    const requested = fetchImpl.mock.calls.map(([input]) => String(input));
    expect(CHANGE_RADAR_SOURCE_REGISTRY.sources.filter((source) => source.lifecycle !== "APPROVED_MONITOR").every((source) => !requested.includes(source.canonicalUrl))).toBe(true);
  });

  it("discovers only indexes with fair retained and truncated counts", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("robots.txt")) return robotsAllowed();
      const prefix = url.includes("platform") ? "https://platform.claude.com/docs/en" : "https://code.claude.com/docs/en";
      return new Response(Array.from({ length: 6 }, (_, index) => `${prefix}/candidate-${index}.md`).join("\n"), { headers: { "content-type": "text/plain" } });
    });
    const result = await discoverDetailed({ fetchImpl, perIndexCap: 4, totalCap: 6 });
    expect(result.candidates).toHaveLength(6);
    expect(result.counts).toEqual([
      { discoveredFrom: "code-index", discovered: 6, retained: 3, truncated: 3 },
      { discoveredFrom: "platform-index", discovered: 6, retained: 3, truncated: 3 },
    ]);
    expect(result.candidates.every(({ enabled }) => enabled === false)).toBe(true);
    const sourceRequests = fetchImpl.mock.calls.map(([input]) => String(input)).filter((url) => !url.endsWith("robots.txt"));
    expect(sourceRequests.sort()).toEqual(CHANGE_RADAR_SOURCE_REGISTRY.sources.filter((source) => source.lifecycle === "DISCOVERY_INDEX").map((source) => source.canonicalUrl).sort());
  });

  it("preserves repeated headings and deduplicates events/history", () => {
    expect(sectionize("# A\n## Same\none\n## Same\ntwo").filter(({ headingPath }) => headingPath.at(-1) === "Same").map(({ occurrence }) => occurrence)).toEqual([1, 2]);
    const event = parseLatestArtifact(JSON.parse(readFileSyncFixture()), { bindToRegistry: false }).events[0];
    expect(retainBoundedHistory([event], [event])).toEqual([event]);
  });
});

function readFileSyncFixture() {
  const event = {
    id: "change:0123456789abcdef0123456789abcdef", sourceId: "source", sourceTitle: "Source", canonicalUrl: "https://example.test/docs", sourceKind: "DOCUMENTATION", officialHost: "example.test", productSurface: "Docs", fetchedAt: "2026-09-02T00:00:00.000Z", publishedAt: null, detectedAt: "2026-09-02T00:00:00.000Z", previousHash: null, currentHash: "a".repeat(64), etag: null, lastModified: null, changeType: "FIRST_SEEN", headingPath: ["Document body"], headingOccurrence: 1, excerptBefore: null, excerptAfter: "Observed", observedFacts: ["Observed"], inferredImpactDomains: [], affectedSyntheticAssets: [], impactLevel: "LOW", classificationConfidence: 0.7, reviewState: "DETECTED", ownerId: null, reviewerIds: [], proposedActions: [], evidenceReceiptId: "receipt:test",
  };
  return JSON.stringify({ schemaVersion: 3, generatedAt: "2026-09-02T00:00:00.000Z", events: [event] });
}

describe("schema and atomic publication", () => {
  it("rejects invalid generated schemas", () => {
    expect(() => parseLatestArtifact({ schemaVersion: 2, events: [] })).toThrow();
    expect(() => parseHistoryArtifact({ schemaVersion: 3, retentionLimit: 1, events: [1, 2] })).toThrow();
    expect(() => parseSourceHealthArtifact({ schemaVersion: 3, generatedAt: "bad", sources: [] })).toThrow();
    expect(() => parseComparisonArtifact({ schemaVersion: 3, generatedAt: "2026-09-02T00:00:00.000Z", sources: [{ sourceId: "x", currentHash: "bad", etag: null, lastModified: null, sections: [] }] })).toThrow();
    expect(() => parsePublicChangeEvent({})).toThrow();
  });

  it("atomically writes validated artifacts without temp residue", async () => {
    const root = await mkdtemp(join(tmpdir(), "radar-hardening-")); roots.push(root);
    await writeRadarArtifacts(root, { generatedAt: "2026-09-02T00:00:00.000Z", events: [], health: [], baselines: {} });
    const directory = join(root, "src/generated/change-radar");
    expect((await readdir(directory)).sort()).toEqual(["comparison-state.json", "history.json", "latest.json", "source-health.json"]);
    expect((await readdir(directory)).some((name) => name.endsWith(".tmp"))).toBe(false);
    parseLatestArtifact(JSON.parse(await readFile(join(directory, "latest.json"), "utf8")));
    parseHistoryArtifact(JSON.parse(await readFile(join(directory, "history.json"), "utf8")));
    parseSourceHealthArtifact(JSON.parse(await readFile(join(directory, "source-health.json"), "utf8")));
    parseComparisonArtifact(JSON.parse(await readFile(join(directory, "comparison-state.json"), "utf8")));
  });

  it("fails closed instead of consuming malformed prior artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "radar-malformed-")); roots.push(root);
    const directory = join(root, "src/generated/change-radar");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "history.json"), "{malformed", "utf8");

    await expect(writeRadarArtifacts(root, {
      generatedAt: "2026-09-02T00:00:00.000Z",
      events: [],
      health: [],
      baselines: {},
    })).rejects.toThrow();
    expect((await readdir(directory)).some((name) => name.endsWith(".tmp"))).toBe(false);
  });
});
