import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { discoverDetailed } from "./discover.ts";
import {
  parseComparisonArtifact,
  parseDiscoveryArtifact,
  parseHistoryArtifact,
  parseLatestArtifact,
  parseSourceHealthArtifact,
} from "../../lib/change-radar/schema.ts";

const root = resolve(import.meta.dirname, "../..");

async function writeJsonAtomic(relative: string, value: unknown) {
  const path = resolve(root, relative);
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function readRequiredJson(relative: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(root, relative), "utf8"));
}

async function runDiscovery() {
  const discovery = await discoverDetailed();
  const candidates = discovery.candidates;
  const relative = "src/generated/change-radar/discovery-candidates.json";
  const path = resolve(root, relative);
  let previous: ReturnType<typeof parseDiscoveryArtifact> | null = null;

  try {
    previous = parseDiscoveryArtifact(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const previousUrls = new Set((previous?.candidates ?? []).map(({ url }) => url));
  const currentUrls = new Set(candidates.map(({ url }) => url));
  const added = candidates.filter(({ url }) => !previousUrls.has(url)).map(({ url }) => url);
  const removed = [...previousUrls].filter((url) => !currentUrls.has(url));

  if (added.length || removed.length || previous?.schemaVersion !== 3) {
    await writeJsonAtomic(relative, {
      schemaVersion: 3,
      generatedAt: new Date().toISOString(),
      note: "Disabled discovery candidates; human review is required before enablement.",
      addedCount: added.length,
      removedCount: removed.length,
      added: added.slice(0, 50),
      removed: removed.slice(0, 50),
      perIndexCounts: discovery.counts,
      candidates,
    });
  }

  console.log(`Discovered ${candidates.length} disabled candidates (${added.length} added, ${removed.length} removed).`);
}

async function validateArtifacts() {
  parseLatestArtifact(await readRequiredJson("src/generated/change-radar/latest.json"));
  parseHistoryArtifact(await readRequiredJson("src/generated/change-radar/history.json"));
  parseSourceHealthArtifact(await readRequiredJson("src/generated/change-radar/source-health.json"));
  parseComparisonArtifact(await readRequiredJson("src/generated/change-radar/comparison-state.json"));
  parseDiscoveryArtifact(await readRequiredJson("src/generated/change-radar/discovery-candidates.json"));
  console.log("Change Radar artifacts are schema-valid.");
}

async function reportArtifacts() {
  const latest = parseLatestArtifact(await readRequiredJson("src/generated/change-radar/latest.json"));
  const health = parseSourceHealthArtifact(await readRequiredJson("src/generated/change-radar/source-health.json"));
  const stages = ["HEALTHY", "TRANSPORT_ERROR", "PARSING_ERROR", "SEMANTIC_ERROR"] as const;
  console.log(JSON.stringify({
    generatedAt: latest.generatedAt,
    eventCount: latest.events.length,
    sourceHealth: Object.fromEntries(stages.map((stage) => [
      stage,
      health.sources.filter((source) => source.stage === stage).length,
    ])),
    rule: "Observed source data never mutates synthetic policy automatically.",
  }, null, 2));
}

async function main() {
  const command = process.argv[2] ?? "report";
  if (command === "discover") return runDiscovery();
  if (command === "sync") {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", resolve(root, "scripts/check-anthropic-docs.mjs")],
      { stdio: "inherit" },
    );
    process.exitCode = result.status ?? 1;
    return;
  }
  if (command === "fixtures") {
    console.log("Deterministic Change Radar fixtures are validated by Vitest.");
    return;
  }
  if (command === "validate") return validateArtifacts();
  if (command === "report") return reportArtifacts();
  throw new Error(`Unknown Change Radar command: ${command}`);
}

await main();
