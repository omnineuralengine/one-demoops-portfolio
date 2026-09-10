import { describe, expect, it, vi } from "vitest";

import { CHANGE_RADAR_SOURCE_REGISTRY } from "../../data/change-radar/registry";
import {
  createGoldenLoopRun,
  MODEL_ENTITLEMENT_REHEARSAL,
} from "../../features/causal-loop";
import {
  hashNormalizedContent,
  normalizeDocumentation,
} from "../../scripts/change-radar-core.mjs";
import { comparisonSections } from "../../scripts/change-radar/diff";
import { runRadar } from "../../scripts/change-radar/orchestrator";

describe("model-entitlement rehearsal pipeline", () => {
  it("regenerates the UI fixture through the governed fetch-to-event path", async () => {
    const source = CHANGE_RADAR_SOURCE_REGISTRY.sources.find(
      ({ id }) => id === MODEL_ENTITLEMENT_REHEARSAL.sourceId,
    );
    expect(source).toBeDefined();

    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).endsWith("robots.txt")) {
        return new Response("User-agent: *\nAllow: /", {
          headers: { "content-type": "text/plain" },
        });
      }
      return new Response(MODEL_ENTITLEMENT_REHEARSAL.currentDocument, {
        headers: { "content-type": "text/html" },
      });
    });

    const previous = normalizeDocumentation(
      MODEL_ENTITLEMENT_REHEARSAL.previousDocument,
      { format: source!.expectedContentType },
    );
    const result = await runRadar({
      fetchImpl,
      now: () => new Date(MODEL_ENTITLEMENT_REHEARSAL.detectedAt),
      order: () => [source!.id],
      previous: {
        [source!.id]: {
          currentHash: hashNormalizedContent(previous),
          sections: comparisonSections(previous),
          etag: null,
          lastModified: null,
        },
      },
    });
    expect(result.health).toEqual([
      expect.objectContaining({ sourceId: source!.id, stage: "HEALTHY" }),
    ]);
    expect(result.events).toHaveLength(1);
    const emitted = result.events[0];
    const { title: _title, scenario: _scenario, evidence: _evidence, observedFacts, ...uiEvent } =
      createGoldenLoopRun().change;

    // The collector sees a mocked official fetch. The shipped fixture must relabel
    // that authored input, while retaining every hash, ID, and contract field.
    const { observedFacts: collectorFacts, ...emittedEvent } = emitted;
    expect(collectorFacts).toEqual([
      "Official source content changed at Models > Availability > Entitlement prerequisites (occurrence 1).",
    ]);
    expect(observedFacts).toEqual([
      "Authored fixture input changed at Models > Availability > Entitlement prerequisites (occurrence 1); not an observed public-page change.",
    ]);
    expect(emittedEvent).toEqual(uiEvent);
    expect(emitted.id).toBe("change:bffcb5c9f00cf34956139cad9c3718e3");
  });
});
