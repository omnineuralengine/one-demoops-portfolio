import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { CHANGE_RADAR_SOURCE_REGISTRY } from "../../data/change-radar/registry";
import {
  parseComparisonArtifact,
  parseDiscoveryArtifact,
  parseGeneratedArtifact,
  parseLatestArtifact,
  parsePublicChangeEvent,
  parseSourceHealthArtifact,
} from "../../lib/change-radar/schema";

// @ts-expect-error The publication boundary is intentionally native ESM for dependency-free CI use.
import { validatePublicJson } from "../../scripts/validate-change-radar-publication.mjs";

const generatedAt = "2026-09-02T00:00:00.000Z";
const approvedSource = CHANGE_RADAR_SOURCE_REGISTRY.sources.find(
  (source) => source.lifecycle === "APPROVED_MONITOR",
)!;
const discoveryIndexes = CHANGE_RADAR_SOURCE_REGISTRY.sources
  .filter((source) => source.lifecycle === "DISCOVERY_INDEX")
  .sort((left, right) => left.id.localeCompare(right.id));

function validEvent() {
  const canonicalUrl = approvedSource.canonicalUrl;
  return {
    id: "change:0123456789abcdef0123456789abcdef",
    sourceId: approvedSource.id,
    sourceTitle: approvedSource.title,
    canonicalUrl,
    sourceKind: approvedSource.sourceKind,
    officialHost: new URL(canonicalUrl).hostname,
    productSurface: approvedSource.productSurface,
    fetchedAt: generatedAt,
    publishedAt: null,
    detectedAt: generatedAt,
    previousHash: null,
    currentHash: "a".repeat(64),
    etag: null,
    lastModified: null,
    changeType: "FIRST_SEEN",
    headingPath: ["Document body"],
    headingOccurrence: 1,
    excerptBefore: null,
    excerptAfter: "Observed",
    observedFacts: ["Observed"],
    inferredImpactDomains: [...approvedSource.operationalDomains],
    affectedSyntheticAssets: [],
    impactLevel: "LOW",
    classificationConfidence: 0.7,
    reviewState: "DETECTED",
    ownerId: approvedSource.expectedOwner,
    reviewerIds: [],
    proposedActions: [],
    evidenceReceiptId: "receipt:test",
  };
}

function validDiscoveryV3() {
  const candidateIndex = discoveryIndexes.find((source) => source.id === "platform-index")!;
  const candidateUrl = "https://platform.claude.com/docs/en/security-fixture.md";
  return {
    schemaVersion: 3,
    generatedAt,
    note: "Disabled discovery candidates; human review is required before enablement.",
    addedCount: 1,
    removedCount: 0,
    added: [candidateUrl],
    removed: [],
    perIndexCounts: discoveryIndexes.map((source) => ({
      discoveredFrom: source.id,
      discovered: source.id === candidateIndex.id ? 1 : 0,
      retained: source.id === candidateIndex.id ? 1 : 0,
      truncated: 0,
    })),
    candidates: [{ url: candidateUrl, discoveredFrom: candidateIndex.id, enabled: false }],
  };
}

describe("closed-world Change Radar schemas", () => {
  it("rejects unknown keys at every publishable object depth", () => {
    const event = validEvent();
    expect(() => parseLatestArtifact({ schemaVersion: 3, generatedAt, events: [], extra: true }))
      .toThrow(/unknown field.*extra/i);
    expect(() => parseLatestArtifact({ schemaVersion: 3, generatedAt, events: [{ ...event, extra: true }] }))
      .toThrow(/unknown field.*extra/i);

    expect(() => parseSourceHealthArtifact({
      schemaVersion: 3,
      generatedAt,
      sources: [{
        sourceId: approvedSource.id,
        checkedAt: generatedAt,
        stage: "HEALTHY",
        reason: null,
        statusCode: 200,
        extra: true,
      }],
    })).toThrow(/unknown field.*extra/i);

    const section = {
      headingPath: ["A"],
      occurrence: 1,
      order: 0,
      hash: "b".repeat(64),
      excerpt: null,
    };
    expect(() => parseComparisonArtifact({
      schemaVersion: 3,
      generatedAt,
      sources: [{
        sourceId: approvedSource.id,
        currentHash: "a".repeat(64),
        etag: null,
        lastModified: null,
        sections: [{ ...section, extra: true }],
      }],
    })).toThrow(/unknown field.*extra/i);
    expect(() => parseComparisonArtifact({
      schemaVersion: 3,
      generatedAt,
      sources: [{
        sourceId: approvedSource.id,
        currentHash: "a".repeat(64),
        etag: null,
        lastModified: null,
        sections: [],
        extra: true,
      }],
    })).toThrow(/unknown field.*extra/i);
  });

  it("binds live artifacts to approved monitor identity", () => {
    const event = validEvent();
    expect(() => parsePublicChangeEvent({ ...event, sourceId: "platform-index" }))
      .toThrow(/approved monitor/i);
    expect(() => parseGeneratedArtifact({
      schemaVersion: 3,
      generatedAt,
      events: [{ ...event, sourceId: "platform-index" }],
    }, "src/generated/change-radar/latest.json")).toThrow(/approved monitor/i);
    expect(() => parseGeneratedArtifact({
      schemaVersion: 3,
      generatedAt,
      events: [{ ...event, sourceTitle: "Spoofed source" }],
    }, "src/generated/change-radar/latest.json")).toThrow(/does not match approved monitor/i);
    expect(() => parseLatestArtifact({
      schemaVersion: 3,
      generatedAt,
      events: [{ ...event, ownerId: "forged-owner" }],
    })).toThrow(/ownerId does not match approved monitor/i);
    expect(() => parseLatestArtifact({
      schemaVersion: 3,
      generatedAt,
      events: [{ ...event, inferredImpactDomains: ["forged-domain"] }],
    })).toThrow(/inferredImpactDomains do not match approved monitor/i);
    expect(() => parseGeneratedArtifact({
      schemaVersion: 3,
      generatedAt,
      sources: [{
        sourceId: "platform-index",
        checkedAt: generatedAt,
        stage: "HEALTHY",
        reason: null,
        statusCode: 200,
      }],
    }, "src/generated/change-radar/source-health.json")).toThrow(/approved monitor/i);
  });

  it("validates discovery metadata and binds candidates and counts to discovery indexes", () => {
    expect(() => parseDiscoveryArtifact({ ...validDiscoveryV3(), extra: true }))
      .toThrow(/unknown field.*extra/i);

    const unknownCandidateKey = validDiscoveryV3();
    unknownCandidateKey.candidates = [{ ...unknownCandidateKey.candidates[0], extra: true }] as never;
    expect(() => parseDiscoveryArtifact(unknownCandidateKey)).toThrow(/unknown field.*extra/i);

    const unknownCountKey = validDiscoveryV3();
    unknownCountKey.perIndexCounts[0] = { ...unknownCountKey.perIndexCounts[0], extra: true } as never;
    expect(() => parseDiscoveryArtifact(unknownCountKey)).toThrow(/unknown field.*extra/i);

    const ungovernedCandidate = validDiscoveryV3();
    ungovernedCandidate.candidates[0] = {
      ...ungovernedCandidate.candidates[0],
      discoveredFrom: "unregistered-index",
    };
    expect(() => parseDiscoveryArtifact(ungovernedCandidate)).toThrow(/unknown discovery index/i);

    const outsideIndex = validDiscoveryV3();
    outsideIndex.candidates[0] = { ...outsideIndex.candidates[0], url: "https://evil.example/docs.md" };
    expect(() => parseDiscoveryArtifact(outsideIndex)).toThrow(/outside its discovery index allowlist/i);

    const nonDefaultPort = validDiscoveryV3();
    nonDefaultPort.candidates[0] = {
      ...nonDefaultPort.candidates[0],
      url: "https://platform.claude.com:8443/docs/en/security-fixture.md",
    };
    expect(() => parseDiscoveryArtifact(nonDefaultPort)).toThrow(/uncredentialed HTTPS/i);

    const approvedMonitorAlias = validDiscoveryV3();
    const platformMonitor = CHANGE_RADAR_SOURCE_REGISTRY.sources.find(
      (source) => source.id === "platform-release-notes",
    )!;
    approvedMonitorAlias.added = [`${platformMonitor.canonicalUrl}#alias`];
    approvedMonitorAlias.candidates[0] = {
      ...approvedMonitorAlias.candidates[0],
      url: `${platformMonitor.canonicalUrl}#alias`,
    };
    expect(() => parseDiscoveryArtifact(approvedMonitorAlias)).toThrow(/query or fragment/i);

    const inconsistentMetadata = validDiscoveryV3();
    inconsistentMetadata.addedCount = 0;
    expect(() => parseDiscoveryArtifact(inconsistentMetadata)).toThrow(/change count|50-URL cap/i);
  });

  it("preserves the current legacy discovery artifact and current publishable artifacts", () => {
    const generatedDirectory = resolve("src/generated/change-radar");
    expect(() => parseDiscoveryArtifact(JSON.parse(
      readFileSync(resolve(generatedDirectory, "discovery-candidates.json"), "utf8"),
    ))).not.toThrow();
    for (const fileName of ["latest.json", "history.json", "source-health.json", "comparison-state.json"]) {
      expect(() => parseGeneratedArtifact(
        JSON.parse(readFileSync(resolve(generatedDirectory, fileName), "utf8")),
        `src/generated/change-radar/${fileName}`,
      )).not.toThrow();
    }
  });
});

describe("publication schema dispatch and sensitive-key normalization", () => {
  it.each(["raw_body", "fullDocument", "api_key", "set-cookie", "Set_Cookie"])(
    "rejects normalized forbidden key variant %s at nested depth",
    (key) => {
      const value = {
        schemaVersion: 3,
        generatedAt,
        events: [{ ...validEvent(), observedFacts: [{ [key]: "unsafe" }] }],
      };
      expect(() => validatePublicJson(
        Buffer.from(JSON.stringify(value)),
        "src/generated/change-radar/latest.json",
      )).toThrow(new RegExp(`${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} is forbidden`, "i"));
    },
  );

  it("rejects a valid schema stored under the wrong publishable filename", () => {
    expect(() => validatePublicJson(
      Buffer.from(JSON.stringify({ schemaVersion: 3, generatedAt, events: [] })),
      "src/generated/change-radar/source-health.json",
    )).toThrow(/unknown field.*events/i);
    expect(() => validatePublicJson(
      Buffer.from(JSON.stringify({ schemaVersion: 3, generatedAt, events: [] })),
      "../../latest.json",
    )).toThrow(/No generated Change Radar schema is registered/i);
  });
});
