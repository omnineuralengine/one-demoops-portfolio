import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(".github/workflows/ci.yml");

describe("public release automation boundary", () => {
  it("includes only a read-only validation workflow", async () => {
    const workflows = await readdir(resolve(".github/workflows"));
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflows).toEqual(["ci.yml"]);
    expect(workflow).toContain("permissions: {}");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toMatch(/:\s*(?:write|write-all)\b/);
    expect(workflow).not.toMatch(/\b(?:secrets\.|github\.token|pull_request_target|workflow_run|schedule:)/);
    expect(workflow).not.toMatch(/github\.repository\s*==|event\.repository\.private/);
  });

  it("limits action execution to reviewed immutable pins and saves no checkout credentials", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const actions = [...workflow.matchAll(/^\s+uses:\s+(\S+)/gm)].map((match) => match[1]);

    expect(actions).toEqual([
      "actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683",
      "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    ]);
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).not.toMatch(/persist-credentials:\s*true/);
  });

  it("runs local checks without live source synchronization, uploads, or deployment", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    // Any new command or block requires review of its network and write authority.
    const commands = [...workflow.matchAll(/^\s+run:\s+(.+)$/gm)].map((match) => match[1].trim());

    expect(commands).toEqual([
      "npm ci --ignore-scripts --no-audit --no-fund",
      "npm run lint",
      "npm run typecheck",
      "npm test",
      "npm run radar:validate",
      "npm run build",
      "npm exec -- playwright install --with-deps chromium",
      "npm run test:e2e",
    ]);
    expect(workflow).not.toMatch(/radar:(?:sync|discover)|docs:check|validate-change-radar-publication|\bdeploy\b/i);
  });
});
