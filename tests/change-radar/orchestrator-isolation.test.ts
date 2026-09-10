import { describe, expect, it, vi } from "vitest";

import { CHANGE_RADAR_SOURCE_REGISTRY } from "../../data/change-radar/registry";
import type { ChangeRadarSource } from "../../lib/change-radar/types";
import {
  parseComparisonArtifact,
  parseLatestArtifact,
  parseSourceHealthArtifact,
} from "../../lib/change-radar/schema";
import {
  hashNormalizedContent,
  normalizeDocumentation,
} from "../../scripts/change-radar-core.mjs";
import { comparisonSections } from "../../scripts/change-radar/diff";
import { buildPublicChangeEvent } from "../../scripts/change-radar/emit";
import {
  type RadarBaseline,
  runRadar,
} from "../../scripts/change-radar/orchestrator";
import {
  MAX_COMPARISON_SECTIONS,
  sectionize,
} from "../../scripts/change-radar/sectionize";

const APPROVED_HTML_SOURCES = CHANGE_RADAR_SOURCE_REGISTRY.sources.filter(
  (source) => source.lifecycle === "APPROVED_MONITOR" && source.expectedContentType === "HTML",
);
const SOURCE = APPROVED_HTML_SOURCES[0];
const HEALTHY_SOURCE = APPROVED_HTML_SOURCES[1];
const AT = () => new Date("2026-09-02T00:00:00.000Z");

function baselineFor(source: ChangeRadarSource, html: string): RadarBaseline {
  const normalized = normalizeDocumentation(html, { format: source.expectedContentType });
  return {
    currentHash: hashNormalizedContent(normalized),
    sections: comparisonSections(normalized),
    etag: '"old"',
    lastModified: null,
  };
}

function htmlResponse(body: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "text/html");
  return new Response(body, { ...init, headers });
}

function robotsResponse() {
  return new Response("User-agent: *\nAllow: /", {
    headers: { "content-type": "text/plain" },
  });
}

describe("Change Radar source transaction isolation", () => {
  it.each([
    ["transport", () => htmlResponse("Unavailable", { status: 404 }), "TRANSPORT_ERROR"],
    ["parsing", () => new Response("{}", { headers: { "content-type": "application/json" } }), "PARSING_ERROR"],
    ["semantic", () => htmlResponse("<title>Just a moment...</title><div id='cf-chl-widget'>Checking</div>"), "SEMANTIC_ERROR"],
  ] as const)("retains the prior baseline after a %s failure", async (_label, failureResponse, expectedStage) => {
    const previous = baselineFor(SOURCE, "<h1>API</h1><p>The original official API documentation remains the trusted comparison state.</p>");
    const fetchImpl = vi.fn<typeof fetch>(async (input) => String(input).endsWith("robots.txt")
      ? robotsResponse()
      : failureResponse());

    const result = await runRadar({
      fetchImpl,
      now: AT,
      order: () => [SOURCE.id],
      previous: { [SOURCE.id]: previous },
    });

    expect(result.baselines[SOURCE.id]).toBe(previous);
    expect(result.events).toEqual([]);
    expect(result.health).toEqual([
      expect.objectContaining({ sourceId: SOURCE.id, stage: expectedStage }),
    ]);
  });

  it("compares a recovered source against the retained baseline", async () => {
    const previous = baselineFor(SOURCE, "<h1>API</h1><p>The original official API documentation remains the trusted comparison state.</p>");
    const recoveredBody = "<h1>API</h1><p>The recovered official API documentation now contains a required migration notice.</p>";
    const fetchImpl = vi.fn<typeof fetch>(async (input) => String(input).endsWith("robots.txt")
      ? robotsResponse()
      : htmlResponse(recoveredBody));

    const recovered = await runRadar({
      fetchImpl,
      now: AT,
      order: () => [SOURCE.id],
      previous: { [SOURCE.id]: previous },
    });

    expect(recovered.health[0].stage).toBe("HEALTHY");
    expect(recovered.events).toHaveLength(1);
    expect(recovered.events[0].previousHash).toBe(previous.currentHash);
    expect(recovered.baselines[SOURCE.id].currentHash).not.toBe(previous.currentHash);
  });

  it("discards all source events and the candidate baseline when late event validation fails", async () => {
    const previous = baselineFor(SOURCE, [
      "<h1>Reference</h1>",
      "<h2>Models</h2><p>The original models reference contains enough stable comparison content.</p>",
      "<h2>API</h2><p>The original API reference contains enough stable comparison content.</p>",
    ].join(""));
    const changedBody = [
      "<h1>Reference</h1>",
      "<h2>Models</h2><p>The changed models reference contains enough stable comparison content.</p>",
      "<h2>API</h2><p>The changed API reference contains enough stable comparison content.</p>",
    ].join("");
    const fetchImpl = vi.fn<typeof fetch>(async (input) => String(input).endsWith("robots.txt")
      ? robotsResponse()
      : htmlResponse(changedBody));
    let eventCount = 0;
    const eventBuilder: typeof buildPublicChangeEvent = (...args) => {
      eventCount += 1;
      const event = buildPublicChangeEvent(...args);
      return eventCount === 2
        ? { ...event, currentHash: "invalid" }
        : event;
    };

    const failed = await runRadar({
      fetchImpl,
      now: AT,
      order: () => [SOURCE.id],
      previous: { [SOURCE.id]: previous },
      eventBuilder,
    });

    expect(eventCount).toBe(2);
    expect(failed.events).toEqual([]);
    expect(failed.baselines[SOURCE.id]).toBe(previous);
    expect(failed.health[0]).toEqual(expect.objectContaining({
      stage: "SEMANTIC_ERROR",
      reason: "Invalid event hashes.",
    }));

    const recovered = await runRadar({
      fetchImpl,
      now: AT,
      order: () => [SOURCE.id],
      previous: failed.baselines,
    });
    expect(recovered.health[0].stage).toBe("HEALTHY");
    expect(recovered.events).toHaveLength(2);
    expect(recovered.events.every((event) => event.previousHash === previous.currentHash)).toBe(true);
    expect(recovered.baselines[SOURCE.id].currentHash).not.toBe(previous.currentHash);
  });

  it("rejects 501 headings and continues processing another source", async () => {
    const oversized = Array.from(
      { length: MAX_COMPARISON_SECTIONS + 1 },
      (_, index) => `<h2>Heading ${index + 1}</h2><p>Stable official section content ${index + 1}.</p>`,
    ).join("");
    const healthy = "<h1>Healthy source</h1><p>This official source remains independently processable and semantically valid.</p>";
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("robots.txt")) return robotsResponse();
      return htmlResponse(url === SOURCE.canonicalUrl ? oversized : healthy);
    });

    expect(() => sectionize(Array.from(
      { length: MAX_COMPARISON_SECTIONS + 1 },
      (_, index) => `# Heading ${index + 1}\nSection ${index + 1}`,
    ).join("\n"))).toThrow(/500-section comparison limit/);

    const result = await runRadar({
      fetchImpl,
      now: AT,
      order: () => [SOURCE.id, HEALTHY_SOURCE.id],
    });

    expect(result.health).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: SOURCE.id, stage: "PARSING_ERROR" }),
      expect.objectContaining({ sourceId: HEALTHY_SOURCE.id, stage: "HEALTHY" }),
    ]));
    expect(result.baselines[SOURCE.id]).toBeUndefined();
    expect(result.baselines[HEALTHY_SOURCE.id]).toBeDefined();
    expect(result.events.map((event) => event.sourceId)).toEqual([HEALTHY_SOURCE.id]);
  });

  it.each([
    ["a 501-character heading", () => htmlResponse(`<h1>${"h".repeat(501)}</h1><p>This official source has enough semantic content but exceeds the comparison heading bound.</p>`)],
    ["an oversized ETag", () => htmlResponse("<h1>Release notes</h1><p>This official source has enough stable semantic content for comparison.</p>", { headers: { etag: `"${"e".repeat(9_000)}"` } })],
  ] as const)("isolates %s before marking the source healthy", async (_label, hostileResponse) => {
    const healthy = "<h1>Healthy source</h1><p>This official source remains independently processable and semantically valid.</p>";
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("robots.txt")) return robotsResponse();
      return url === SOURCE.canonicalUrl ? hostileResponse() : htmlResponse(healthy);
    });

    const result = await runRadar({
      fetchImpl,
      now: AT,
      order: () => [SOURCE.id, HEALTHY_SOURCE.id],
    });

    expect(result.health).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: SOURCE.id, stage: "SEMANTIC_ERROR" }),
      expect.objectContaining({ sourceId: HEALTHY_SOURCE.id, stage: "HEALTHY" }),
    ]));
    expect(result.baselines[SOURCE.id]).toBeUndefined();
    expect(result.baselines[HEALTHY_SOURCE.id]).toBeDefined();
    expect(result.events.every((event) => event.sourceId === HEALTHY_SOURCE.id)).toBe(true);

    expect(() => parseComparisonArtifact({
      schemaVersion: 3,
      generatedAt: result.generatedAt,
      sources: Object.entries(result.baselines).map(([sourceId, baseline]) => ({ sourceId, ...baseline })),
    })).not.toThrow();
    expect(() => parseLatestArtifact({ schemaVersion: 3, generatedAt: result.generatedAt, events: result.events })).not.toThrow();
    expect(() => parseSourceHealthArtifact({ schemaVersion: 3, generatedAt: result.generatedAt, sources: result.health })).not.toThrow();
  });
});
