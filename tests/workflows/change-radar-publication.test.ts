import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The dependency-free workflow helper is native ESM; runtime exports are tested below.
import * as publicationBoundary from "../../scripts/validate-change-radar-publication.mjs";

const { PUBLISHABLE_PATHS, applyPublication, stagePublication, validatePublicJson } = publicationBoundary;

const temporaryRoots: string[] = [];

async function temporaryDirectory(prefix: string) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(directory);
  return directory;
}

function git(repoRoot: string, ...args: string[]) {
  return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" }).trim();
}

async function writeJson(root: string, path: string, value: unknown) {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validArtifact(path: string, generatedAt = "2026-09-02T00:00:00.000Z") {
  if (path.endsWith("history.json")) return { schemaVersion: 3, retentionLimit: 100, events: [] };
  if (path.endsWith("latest.json")) return { schemaVersion: 3, generatedAt, events: [] };
  return { schemaVersion: 3, generatedAt, sources: [] };
}

async function createFixtureRepository() {
  const repoRoot = await temporaryDirectory("change-radar-repo-");
  git(repoRoot, "init", "--initial-branch=main");
  git(repoRoot, "config", "user.email", "test@example.invalid");
  git(repoRoot, "config", "user.name", "Fixture Reviewer");
  for (const path of PUBLISHABLE_PATHS) {
    await writeJson(repoRoot, path, validArtifact(path));
  }
  git(repoRoot, "add", ".");
  git(repoRoot, "commit", "-m", "fixture baseline");
  return repoRoot;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("Change Radar workflow publication boundary", () => {
  it("uses a closed allowlist for generated review evidence", () => {
    expect(PUBLISHABLE_PATHS).toEqual([
      "src/generated/change-radar/comparison-state.json",
      "src/generated/change-radar/history.json",
      "src/generated/change-radar/latest.json",
      "src/generated/change-radar/source-health.json",
    ]);
    expect(PUBLISHABLE_PATHS).not.toContain("src/generated/change-radar/discovery-candidates.json");
  });

  it("rejects raw bodies, sensitive fields, and unbounded strings", () => {
    expect(() => validatePublicJson(Buffer.from('{"schemaVersion":3,"rawBody":"unsafe"}'), "latest.json"))
      .toThrow(/rawBody is forbidden/);
    expect(() => validatePublicJson(Buffer.from('{"schemaVersion":3,"authorization":"unsafe"}'), "latest.json"))
      .toThrow(/authorization is forbidden/);
    expect(() => validatePublicJson(Buffer.from('{"schemaVersion":3,"raw_body":"unsafe"}'), "latest.json"))
      .toThrow(/raw_body is forbidden/);
    expect(() => validatePublicJson(Buffer.from('{"schemaVersion":3,"response-body":"unsafe"}'), "latest.json"))
      .toThrow(/response-body is forbidden/);
    expect(() => validatePublicJson(
      Buffer.from(JSON.stringify({ schemaVersion: 3, excerpt: "x".repeat(8_193) })),
      "latest.json",
    )).toThrow(/bounded string limit/);
  });

  it("stages and reapplies only hash-bound files from the same source commit", async () => {
    const repoRoot = await createFixtureRepository();
    const artifactDirectory = join(await temporaryDirectory("change-radar-artifact-parent-"), "bundle");
    const changedPath = "src/generated/change-radar/latest.json";
    const baseline = await readFile(join(repoRoot, changedPath), "utf8");
    await writeJson(repoRoot, changedPath, validArtifact(changedPath, "2026-09-02T00:01:00.000Z"));

    const staged = await stagePublication({ repoRoot, artifactDirectory });
    expect(staged).toMatchObject({ generatedChanged: true, paths: [changedPath] });

    await writeFile(join(repoRoot, changedPath), baseline, "utf8");
    const applied = await applyPublication({ repoRoot, artifactDirectory });
    expect(applied.paths).toEqual([changedPath]);
    expect(JSON.parse(await readFile(join(repoRoot, changedPath), "utf8"))).toMatchObject({
      generatedAt: "2026-09-02T00:01:00.000Z",
      events: [],
    });
  });

  it("fails closed on an unexpected changed path", async () => {
    const repoRoot = await createFixtureRepository();
    const artifactDirectory = join(await temporaryDirectory("change-radar-artifact-parent-"), "bundle");
    await writeFile(join(repoRoot, "unexpected.json"), "{}\n", "utf8");

    await expect(stagePublication({ repoRoot, artifactDirectory })).rejects.toThrow(
      /Unexpected generated paths: unexpected.json/,
    );
  });

  it("refuses to place a publication bundle inside the repository", async () => {
    const repoRoot = await createFixtureRepository();
    const changedPath = "src/generated/change-radar/latest.json";
    await writeJson(repoRoot, changedPath, validArtifact(changedPath, "2026-09-02T00:01:00.000Z"));

    await expect(stagePublication({
      repoRoot,
      artifactDirectory: join(repoRoot, ".publication-bundle"),
    })).rejects.toThrow(/must remain outside the repository/);
  });

  it("detects publication-bundle tampering before applying files", async () => {
    const repoRoot = await createFixtureRepository();
    const artifactDirectory = join(await temporaryDirectory("change-radar-artifact-parent-"), "bundle");
    const changedPath = "src/generated/change-radar/source-health.json";
    const baseline = await readFile(join(repoRoot, changedPath), "utf8");
    await writeJson(repoRoot, changedPath, validArtifact(changedPath, "2026-09-02T00:01:00.000Z"));
    await stagePublication({ repoRoot, artifactDirectory });
    await writeFile(join(repoRoot, changedPath), baseline, "utf8");
    await writeJson(artifactDirectory, `payload/${changedPath}`, { schemaVersion: 3, sources: [] });

    await expect(applyPublication({ repoRoot, artifactDirectory })).rejects.toThrow(/mismatch/);
    expect(await readFile(join(repoRoot, changedPath), "utf8")).toBe(baseline);
  });

  it("detects pull-request body tampering before applying files", async () => {
    const repoRoot = await createFixtureRepository();
    const artifactDirectory = join(await temporaryDirectory("change-radar-artifact-parent-"), "bundle");
    const changedPath = "src/generated/change-radar/history.json";
    const baseline = await readFile(join(repoRoot, changedPath), "utf8");
    await writeJson(repoRoot, changedPath, { schemaVersion: 3, retentionLimit: 99, events: [] });
    await stagePublication({ repoRoot, artifactDirectory });
    await writeFile(join(repoRoot, changedPath), baseline, "utf8");
    await writeFile(join(artifactDirectory, "change-radar-pr.md"), "tampered\n", "utf8");

    await expect(applyPublication({ repoRoot, artifactDirectory })).rejects.toThrow(/deterministic template/);
    expect(await readFile(join(repoRoot, changedPath), "utf8")).toBe(baseline);
  });
});
