import { describe, expect, it } from "vitest";
import { CHANGE_RADAR_SOURCE_REGISTRY, isSourceUrlAllowed, parseChangeRadarRegistry } from "../../data/change-radar/registry";
describe("governed Change Radar registry", () => {
  it("keeps exactly 29 typed sources with explicit lifecycle", () => { expect(CHANGE_RADAR_SOURCE_REGISTRY.sources).toHaveLength(29); expect(CHANGE_RADAR_SOURCE_REGISTRY.sources.filter((s) => s.lifecycle === "DISCOVERY_INDEX")).toHaveLength(2); expect(CHANGE_RADAR_SOURCE_REGISTRY.sources.every((s) => s.expectedOwner && s.purpose)).toBe(true); });
  it("allows only exact HTTPS host, default port, and bounded paths", () => { const source = CHANGE_RADAR_SOURCE_REGISTRY.sources[0]; expect(isSourceUrlAllowed(source, source.canonicalUrl)).toBe(true); expect(isSourceUrlAllowed(source, "https://evil.example/llms.txt")).toBe(false); expect(isSourceUrlAllowed(source, "https://platform.claude.com:8443/llms.txt")).toBe(false); expect(isSourceUrlAllowed(source, "https://platform.claude.com/llms.txt.evil")).toBe(false); });
  it("rejects duplicate registries", () => { const source = CHANGE_RADAR_SOURCE_REGISTRY.sources[0]; expect(() => parseChangeRadarRegistry({ schemaVersion: 3, description: "bad", sources: [source, source] })).toThrow(/duplicate/i); });
  it.each([
    ["lifecycle", { lifecycle: "SELF_PROMOTED" }],
    ["trust", { trustLevel: "UNVERIFIED" }],
    ["path", { allowedPathPrefixes: ["../outside"] }],
    ["host", { exactHosts: ["Platform.Claude.com"] }],
  ])("rejects invalid %s governance", (_label, patch) => {
    const source = { ...CHANGE_RADAR_SOURCE_REGISTRY.sources[0], ...patch };
    expect(() => parseChangeRadarRegistry({ schemaVersion: 3, description: "invalid fixture", sources: [source] })).toThrow();
  });
  it("does not monitor duplicate status or static partnership references", () => { expect(CHANGE_RADAR_SOURCE_REGISTRY.sources.filter((s) => s.sourceKind === "STATUS" && s.lifecycle === "APPROVED_MONITOR")).toHaveLength(1); expect(CHANGE_RADAR_SOURCE_REGISTRY.sources.find((s) => s.id === "claudeforce")?.lifecycle).toBe("REFERENCE_ONLY"); });
});
