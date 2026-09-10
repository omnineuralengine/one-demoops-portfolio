import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CHANGE_RADAR_SOURCE_REGISTRY } from "../../data/change-radar/registry.ts";
import {
  parseComparisonArtifact,
  parseHistoryArtifact,
  parseLatestArtifact,
  parsePublicChangeEvent,
  parseSourceHealthArtifact,
} from "../../lib/change-radar/schema.ts";
import type {
  PublicChangeEvent,
  RadarComparisonSource,
  RadarSourceHealth,
} from "../../lib/change-radar/types.ts";
import {
  hashNormalizedContent,
  isLikelyAccessControlInterstitial,
  normalizeDocumentation,
} from "../change-radar-core.mjs";
import { comparisonSections, diffComparisonSections } from "./diff.ts";
import { buildPublicChangeEvent, HISTORY_LIMIT, retainBoundedHistory } from "./emit.ts";
import { fetchRadarSource, SourceFetchError } from "./fetch.ts";
import { SectionLimitError } from "./sectionize.ts";

export type RadarBaseline = Omit<RadarComparisonSource, "sourceId">;

export interface RadarRunOptions {
  now?: () => Date;
  fetchImpl?: typeof fetch;
  previous?: Readonly<Record<string, RadarBaseline>>;
  order?: (ids: string[]) => string[];
  eventBuilder?: typeof buildPublicChangeEvent;
}

export async function runRadar(options: RadarRunOptions = {}) {
  const generatedAt = (options.now ?? (() => new Date()))().toISOString();
  const approved = CHANGE_RADAR_SOURCE_REGISTRY.sources.filter(
    (source) => source.lifecycle === "APPROVED_MONITOR",
  );
  const sourceIds = (options.order ?? ((values) => [...values].sort()))(
    approved.map((source) => source.id),
  );
  const sourcesById = new Map(approved.map((source) => [source.id, source]));
  const events: PublicChangeEvent[] = [];
  const health: RadarSourceHealth[] = [];
  const baselines: Record<string, RadarBaseline> = {};

  for (const sourceId of sourceIds) {
    const source = sourcesById.get(sourceId);
    if (!source) throw new Error(`Unknown ordered source ${sourceId}.`);
    const previous = options.previous?.[sourceId];
    if (previous) baselines[sourceId] = previous;

    try {
      const fetched = await fetchRadarSource(source, previous, {
        fetchImpl: options.fetchImpl,
      });

      if (fetched.notModified && previous) {
        baselines[sourceId] = previous;
        health.push({
          sourceId,
          checkedAt: generatedAt,
          stage: "HEALTHY",
          reason: null,
          statusCode: 304,
        });
        continue;
      }

      if (!fetched.body || isLikelyAccessControlInterstitial(fetched.body)) {
        health.push({
          sourceId,
          checkedAt: generatedAt,
          stage: "SEMANTIC_ERROR",
          reason: "Empty or access-control response.",
          statusCode: fetched.metadata.statusCode,
        });
        continue;
      }

      const normalized = normalizeDocumentation(fetched.body, {
        format: source.expectedContentType,
      });
      if (normalized.length < 40) {
        health.push({
          sourceId,
          checkedAt: generatedAt,
          stage: "SEMANTIC_ERROR",
          reason: "Normalized content was unexpectedly short.",
          statusCode: fetched.metadata.statusCode,
        });
        continue;
      }

      const currentHash = hashNormalizedContent(normalized);
      let sections: ReturnType<typeof comparisonSections>;
      try {
        sections = comparisonSections(normalized);
      } catch (error) {
        if (error instanceof SectionLimitError) throw error;
        throw new SourceProcessingError("PARSING_ERROR", error);
      }
      const candidateBaseline: RadarBaseline = {
        currentHash,
        sections,
        etag: fetched.metadata.etag,
        lastModified: fetched.metadata.lastModified,
      };
      const candidateEvents: PublicChangeEvent[] = [];

      if (previous?.currentHash !== currentHash) {
        const changes = previous
          ? diffComparisonSections(previous.sections, sections)
          : [{
              type: "ADDED_SECTION" as const,
              headingPath: ["Document body"],
              occurrence: 1,
              excerptBefore: null,
              excerptAfter: sections.find((section) => section.excerpt)?.excerpt
                ?? "Official source baseline recorded.",
            }];

        for (const change of changes) {
          try {
            candidateEvents.push(parsePublicChangeEvent((options.eventBuilder ?? buildPublicChangeEvent)(
              source,
              change,
              { previous: previous?.currentHash ?? null, current: currentHash },
              generatedAt,
              fetched.metadata,
            )));
          } catch (error) {
            throw new SourceProcessingError("SEMANTIC_ERROR", error);
          }
        }
      }

      const candidateHealth: RadarSourceHealth = {
        sourceId,
        checkedAt: generatedAt,
        stage: "HEALTHY",
        reason: null,
        statusCode: fetched.metadata.statusCode,
      };
      try {
        parseComparisonArtifact({
          schemaVersion: 3,
          generatedAt,
          sources: [{ sourceId, ...candidateBaseline }],
        });
        parseLatestArtifact({
          schemaVersion: 3,
          generatedAt,
          events: candidateEvents,
        });
        parseSourceHealthArtifact({
          schemaVersion: 3,
          generatedAt,
          sources: [candidateHealth],
        });
      } catch (error) {
        throw new SourceProcessingError("SEMANTIC_ERROR", error);
      }

      baselines[sourceId] = candidateBaseline;
      events.push(...candidateEvents);
      health.push(candidateHealth);
    } catch (error) {
      health.push({
        sourceId,
        checkedAt: generatedAt,
        stage: error instanceof SourceFetchError
          ? error.stage
          : error instanceof SourceProcessingError
            ? error.stage
            : error instanceof SectionLimitError
              ? "PARSING_ERROR"
              : "TRANSPORT_ERROR",
        reason: error instanceof Error ? error.message.slice(0, 180) : "Transport failed.",
        statusCode: error instanceof SourceFetchError ? error.statusCode : null,
      });
    }
  }

  return {
    generatedAt,
    events: events.sort((left, right) => left.id.localeCompare(right.id)),
    health: health.sort((left, right) => left.sourceId.localeCompare(right.sourceId)),
    baselines,
  };
}

class SourceProcessingError extends Error {
  readonly stage: "PARSING_ERROR" | "SEMANTIC_ERROR";

  constructor(
    stage: "PARSING_ERROR" | "SEMANTIC_ERROR",
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : "Source processing failed.", { cause });
    this.name = "SourceProcessingError";
    this.stage = stage;
  }
}

async function readJson(path: string, fallback: unknown) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export async function loadComparisonState(root: string): Promise<Record<string, RadarBaseline>> {
  const parsed = parseComparisonArtifact(await readJson(
    resolve(root, "src/generated/change-radar/comparison-state.json"),
    { schemaVersion: 3, generatedAt: "1970-01-01T00:00:00.000Z", sources: [] },
  ));
  return Object.fromEntries(
    parsed.sources.map(({ sourceId, ...baseline }) => [sourceId, baseline]),
  );
}

export async function writeRadarArtifacts(
  root: string,
  result: Awaited<ReturnType<typeof runRadar>>,
) {
  const directory = resolve(root, "src/generated/change-radar");
  await mkdir(directory, { recursive: true });
  const oldHistory = parseHistoryArtifact(await readJson(
    resolve(directory, "history.json"),
    { schemaVersion: 3, retentionLimit: HISTORY_LIMIT, events: [] },
  ));
  const outputs = [
    [
      resolve(directory, "latest.json"),
      parseLatestArtifact({ schemaVersion: 3, generatedAt: result.generatedAt, events: result.events }),
    ],
    [
      resolve(directory, "history.json"),
      parseHistoryArtifact({
        schemaVersion: 3,
        retentionLimit: HISTORY_LIMIT,
        events: retainBoundedHistory(oldHistory.events, result.events),
      }),
    ],
    [
      resolve(directory, "source-health.json"),
      parseSourceHealthArtifact({
        schemaVersion: 3,
        generatedAt: result.generatedAt,
        sources: result.health,
      }),
    ],
    [
      resolve(directory, "comparison-state.json"),
      parseComparisonArtifact({
        schemaVersion: 3,
        generatedAt: result.generatedAt,
        sources: Object.entries(result.baselines)
          .map(([sourceId, baseline]) => ({ sourceId, ...baseline }))
          .sort((left, right) => left.sourceId.localeCompare(right.sourceId)),
      }),
    ],
  ] as const;
  const temporaryPaths: string[] = [];

  try {
    for (const [path, value] of outputs) {
      const temporaryPath = `${path}.${process.pid}.tmp`;
      temporaryPaths.push(temporaryPath);
      await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
    }
    for (let index = 0; index < outputs.length; index += 1) {
      await rename(temporaryPaths[index], outputs[index][0]);
    }
  } finally {
    await Promise.all(temporaryPaths.map((path) => rm(path, { force: true })));
  }
}
