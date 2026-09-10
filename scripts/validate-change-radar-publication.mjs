import { execFileSync } from "node:child_process";
import {
  appendFile,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseGeneratedArtifact } from "../lib/change-radar/schema.ts";

export const PUBLISHABLE_PATHS = Object.freeze([
  "src/generated/change-radar/comparison-state.json",
  "src/generated/change-radar/history.json",
  "src/generated/change-radar/latest.json",
  "src/generated/change-radar/source-health.json",
]);

const MANIFEST_NAME = "change-radar-publication-manifest.json";
const BODY_NAME = "change-radar-pr.md";
const PAYLOAD_DIRECTORY = "payload";
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const MAX_STRING_CHARACTERS = 8_192;
const FORBIDDEN_KEYS = new Set([
  "apikey",
  "authorization",
  "body",
  "cookie",
  "cookies",
  "credential",
  "credentials",
  "headers",
  "html",
  "fulldocument",
  "normalizedbody",
  "raw",
  "rawbody",
  "responsebody",
  "secret",
  "secrets",
  "setcookie",
  "token",
]);

function normalizePath(path) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSafeRelativePath(path) {
  const normalized = normalizePath(path);
  assert(path === normalized || path.replaceAll("\\", "/") === normalized, `Non-canonical path: ${path}`);
  assert(!isAbsolute(normalized), `Absolute paths are forbidden: ${path}`);
  assert(!normalized.startsWith("../") && !normalized.includes("/../"), `Path traversal is forbidden: ${path}`);
  assert(PUBLISHABLE_PATHS.includes(normalized), `Path is outside the publication allowlist: ${path}`);
  return normalized;
}

function assertOutsideRepository(repoRoot, candidatePath) {
  const relativePath = relative(repoRoot, candidatePath);
  const isOutside = relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
  assert(isOutside, `Publication bundle must remain outside the repository: ${candidatePath}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function inspectUnknownValue(value, location = "$") {
  if (typeof value === "string") {
    assert(
      value.length <= MAX_STRING_CHARACTERS,
      `${location} exceeds the bounded string limit of ${MAX_STRING_CHARACTERS} characters`,
    );
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectUnknownValue(item, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      assert(!FORBIDDEN_KEYS.has(normalizedKey), `${location}.${key} is forbidden in a public artifact`);
      inspectUnknownValue(child, `${location}.${key}`);
    }
  }
}

export function validatePublicJson(buffer, sourcePath) {
  assert(buffer.byteLength <= MAX_ARTIFACT_BYTES, `${sourcePath} exceeds ${MAX_ARTIFACT_BYTES} bytes`);
  let value;
  try {
    value = JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw new Error(`${sourcePath} is not valid JSON: ${error.message}`);
  }
  assert(value && typeof value === "object" && !Array.isArray(value), `${sourcePath} must contain a JSON object`);
  assert(Number.isInteger(value.schemaVersion) && value.schemaVersion > 0, `${sourcePath} has no valid schemaVersion`);
  inspectUnknownValue(value);
  return parseGeneratedArtifact(value, sourcePath);
}

function runGit(repoRoot, args) {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function listChangedPaths(repoRoot) {
  const tracked = runGit(repoRoot, ["diff", "--name-only", "--no-renames", "-z", "HEAD", "--"])
    .split("\0")
    .filter(Boolean);
  const untracked = runGit(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z", "--"])
    .split("\0")
    .filter(Boolean);
  return [...new Set([...tracked, ...untracked].map(normalizePath))].sort();
}

async function assertRegularFile(root, path) {
  const absolutePath = resolve(root, path);
  const relativePath = relative(root, absolutePath);
  assert(relativePath && !relativePath.startsWith(`..${sep}`) && relativePath !== "..", `Path escapes its root: ${path}`);
  const metadata = await lstat(absolutePath);
  assert(metadata.isFile() && !metadata.isSymbolicLink(), `${path} must be a regular file`);
  return absolutePath;
}

async function readAndValidatePublicFile(root, path) {
  const safePath = assertSafeRelativePath(path);
  const absolutePath = await assertRegularFile(root, safePath);
  const buffer = await readFile(absolutePath);
  validatePublicJson(buffer, safePath);
  return { buffer, safePath };
}

async function writeGitHubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  assert(!name.includes("\n") && !String(value).includes("\n"), "GitHub outputs must be single-line values");
  await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, "utf8");
}

function buildPullRequestBody(sourceHead, paths) {
  return `## Public Change Radar review

This draft contains public-safe, schema-validated change evidence from approved official monitors. The generation job used read-only repository authority; this publication job may write only the files listed below to a dedicated review branch.

Detection is not acceptance. Observed source facts remain separate from derived comparison, inferred impact, proposed work, and synthetic rehearsal data. No policy, entitlement, credential, connector authorization, source lifecycle, deployment, or operational configuration changes automatically.

Human review is required before this draft can be made ready or merged. High-impact and policy-related changes must never be auto-merged.

Source commit: \`${sourceHead}\`

Validated paths:
${paths.map((path) => `- \`${path}\``).join("\n")}

No deployment is included.
`;
}

export async function stagePublication({ repoRoot, artifactDirectory }) {
  const absoluteRepoRoot = await realpath(repoRoot);
  const changedPaths = listChangedPaths(absoluteRepoRoot);
  const unexpectedPaths = changedPaths.filter((path) => !PUBLISHABLE_PATHS.includes(path));
  assert(unexpectedPaths.length === 0, `Unexpected generated paths: ${unexpectedPaths.join(", ")}`);

  for (const path of PUBLISHABLE_PATHS) await readAndValidatePublicFile(absoluteRepoRoot, path);

  if (changedPaths.length === 0) {
    await writeGitHubOutput("generated_changed", "false");
    return { generatedChanged: false, paths: [] };
  }

  const artifactRoot = resolve(artifactDirectory);
  assertOutsideRepository(absoluteRepoRoot, artifactRoot);
  try {
    await stat(artifactRoot);
    throw new Error(`Refusing to overwrite an existing artifact directory: ${artifactRoot}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await mkdir(artifactRoot, { recursive: false });

  const files = [];
  for (const path of changedPaths) {
    const { buffer, safePath } = await readAndValidatePublicFile(absoluteRepoRoot, path);
    const destination = resolve(artifactRoot, PAYLOAD_DIRECTORY, safePath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, buffer, { flag: "wx" });
    files.push({ path: safePath, bytes: buffer.byteLength, sha256: sha256(buffer) });
  }

  const sourceHead = runGit(absoluteRepoRoot, ["rev-parse", "HEAD"]).trim();
  const manifest = { schemaVersion: 1, sourceHead, files };
  await writeFile(join(artifactRoot, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  await writeFile(join(artifactRoot, BODY_NAME), buildPullRequestBody(sourceHead, changedPaths), { flag: "wx" });
  await writeGitHubOutput("generated_changed", "true");
  return { generatedChanged: true, paths: changedPaths, sourceHead };
}

async function listArtifactFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    assert(!entry.isSymbolicLink(), `Publication bundles may not contain symlinks: ${absolutePath}`);
    if (entry.isDirectory()) files.push(...await listArtifactFiles(root, absolutePath));
    else {
      assert(entry.isFile(), `Unsupported artifact entry: ${absolutePath}`);
      files.push(normalizePath(relative(root, absolutePath)));
    }
  }
  return files.sort();
}

export async function applyPublication({ repoRoot, artifactDirectory }) {
  const absoluteRepoRoot = await realpath(repoRoot);
  const artifactRoot = await realpath(artifactDirectory);
  assertOutsideRepository(absoluteRepoRoot, artifactRoot);
  const manifestPath = await assertRegularFile(artifactRoot, MANIFEST_NAME);
  const bodyPath = await assertRegularFile(artifactRoot, BODY_NAME);
  const manifestMetadata = await lstat(manifestPath);
  const bodyMetadata = await lstat(bodyPath);
  assert(manifestMetadata.size <= 64 * 1024, "Publication manifest is unexpectedly large");
  assert(bodyMetadata.size <= 64 * 1024, "Pull-request body is unexpectedly large");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  assert(manifest?.schemaVersion === 1, "Unknown publication manifest schema");
  assert(/^[a-f0-9]{40}$/.test(manifest.sourceHead), "Invalid manifest source commit");
  assert(Array.isArray(manifest.files) && manifest.files.length > 0, "Publication manifest has no files");

  const manifestPaths = manifest.files.map((file) => assertSafeRelativePath(file.path));
  assert(new Set(manifestPaths).size === manifestPaths.length, "Publication manifest contains duplicate paths");
  assert([...manifestPaths].sort().join("\n") === manifestPaths.join("\n"), "Publication manifest paths are not stable-sorted");

  const expectedBundleFiles = [
    BODY_NAME,
    MANIFEST_NAME,
    ...manifestPaths.map((path) => `${PAYLOAD_DIRECTORY}/${path}`),
  ].sort();
  const actualBundleFiles = await listArtifactFiles(artifactRoot);
  assert(actualBundleFiles.join("\n") === expectedBundleFiles.join("\n"), "Publication bundle contains unexpected or missing files");

  const currentHead = runGit(absoluteRepoRoot, ["rev-parse", "HEAD"]).trim();
  assert(currentHead === manifest.sourceHead, `Source branch moved after validation: ${manifest.sourceHead} -> ${currentHead}`);
  const expectedBody = buildPullRequestBody(manifest.sourceHead, manifestPaths);
  const actualBody = await readFile(bodyPath, "utf8");
  assert(actualBody === expectedBody, "Pull-request body differs from the validated deterministic template");

  const verifiedFiles = [];
  for (let index = 0; index < manifest.files.length; index += 1) {
    const descriptor = manifest.files[index];
    const safePath = manifestPaths[index];
    assert(
      Object.keys(descriptor).sort().join("\n") === "bytes\npath\nsha256",
      `Unexpected manifest fields for ${safePath}`,
    );
    assert(Number.isInteger(descriptor.bytes) && descriptor.bytes > 0, `Invalid byte count for ${safePath}`);
    assert(/^[a-f0-9]{64}$/.test(descriptor.sha256), `Invalid digest for ${safePath}`);
    const payloadPath = await assertRegularFile(artifactRoot, `${PAYLOAD_DIRECTORY}/${safePath}`);
    const buffer = await readFile(payloadPath);
    assert(buffer.byteLength === descriptor.bytes, `Byte count mismatch for ${safePath}`);
    assert(sha256(buffer) === descriptor.sha256, `Digest mismatch for ${safePath}`);
    validatePublicJson(buffer, safePath);
    verifiedFiles.push({ safePath, payloadPath });
  }

  for (const { safePath, payloadPath } of verifiedFiles) {
    const destination = await assertRegularFile(absoluteRepoRoot, safePath);
    await copyFile(payloadPath, destination);
  }

  const changedPaths = listChangedPaths(absoluteRepoRoot);
  assert(changedPaths.join("\n") === manifestPaths.join("\n"), "Applied working-tree paths differ from the validated manifest");
  await writeGitHubOutput("body_path", bodyPath);
  return { bodyPath, paths: changedPaths, sourceHead: currentHead };
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const artifactIndex = rest.indexOf("--artifact-dir");
  assert(["stage", "apply"].includes(command), "Usage: validate-change-radar-publication.mjs <stage|apply> --artifact-dir <path>");
  assert(artifactIndex >= 0 && rest[artifactIndex + 1], "--artifact-dir is required");
  assert(rest.length === 2 && artifactIndex === 0, "Unexpected command arguments");
  return { command, artifactDirectory: rest[1] };
}

async function main() {
  const { command, artifactDirectory } = parseArguments(process.argv.slice(2));
  const options = { repoRoot: process.cwd(), artifactDirectory };
  const result = command === "stage" ? await stagePublication(options) : await applyPublication(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(`Change Radar publication boundary rejected output: ${error.message}`);
    process.exitCode = 1;
  });
}
