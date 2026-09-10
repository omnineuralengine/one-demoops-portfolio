import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import type { ScenarioExport } from "../../features/scenario-foundry/domain/types";

test.describe.configure({ mode: "serial" });

interface RuntimeAudit {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
  readonly externalRequests: string[];
  readonly downloads: Download[];
}

function auditRuntime(page: Page): RuntimeAudit {
  const audit: RuntimeAudit = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    externalRequests: [],
    downloads: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") audit.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => audit.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    const isLocalNextDevelopmentHmr =
      (url.protocol === "ws:" || url.protocol === "wss:") &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      url.pathname === "/_next/hmr";
    if (isLocalNextDevelopmentHmr) return;
    audit.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown failure"}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== "127.0.0.1" &&
      url.hostname !== "localhost"
    ) {
      audit.externalRequests.push(request.url());
    }
  });
  page.on("download", (download) => audit.downloads.push(download));
  return audit;
}

function expectCleanRuntime(audit: RuntimeAudit) {
  expect(audit.consoleErrors, "browser console errors").toEqual([]);
  expect(audit.pageErrors, "uncaught page errors").toEqual([]);
  expect(audit.failedRequests, "failed browser requests").toEqual([]);
  expect(audit.externalRequests, "unexpected external network requests").toEqual([]);
}

async function activate(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toBeEnabled();
  await button.press("Enter");
}

async function downloadedText(download: Download): Promise<string> {
  const path = await download.path();
  if (!path) throw new Error("DOWNLOAD_PATH_UNAVAILABLE");
  return readFile(path, "utf8");
}

async function generatedOutputHash(page: Page): Promise<string> {
  const hash = await page
    .getByText("Output hash", { exact: true })
    .locator("..")
    .locator("code")
    .textContent();
  expect(hash).toMatch(/^[a-f0-9]{64}$/);
  return hash ?? "";
}

test("one governed scenario becomes ready, stale, revalidated, reset, destroyed, and cleanly restarted", async ({ page, context }) => {
  const runtime = auditRuntime(page);
  await page.goto("/lab#foundry");
  const initialIndexedDatabases = await page.evaluate(async () =>
    (await window.indexedDB.databases()).map(({ name, version }) => ({ name, version })),
  );

  await expect(page.getByTestId("scenario-foundry-view")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Synthetic Revenue Worlds/i })).toBeVisible();
  await expect(page.getByText("Customer-shaped, never customer-copied.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("foundry-context-receipt")).toHaveCount(0);
  await expect(page.getByTestId("foundry-contract")).toHaveCount(0);
  await expect(page.getByTestId("foundry-generated-world")).toHaveCount(0);
  await expect(page.getByTestId("foundry-review-decision")).toHaveCount(0);
  await expect(page.getByTestId("foundry-activation-receipt")).toHaveCount(0);
  await expect(page.getByTestId("foundry-staleness-receipt")).toHaveCount(0);
  await expect(page.getByText("No Context Receipt exists", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Governance" }).click();
  await expect(page.getByRole("button", { name: "Export reviewed pack (.json)" })).toBeDisabled();
  expect(runtime.downloads).toHaveLength(0);
  await page.getByRole("tab", { name: "Build" }).click();

  await activate(page, "Issue safe Context Receipt");
  const contextReceipt = page.getByTestId("foundry-context-receipt");
  await expect(contextReceipt).toContainText("Safe Context Receipt");
  await expect(contextReceipt).toContainText("ACCEPTED");
  await expect(contextReceipt).toContainText("context-firewall:v1");
  await expect(contextReceipt).toContainText(/Coarsened into approved band/i);
  await expect(page.getByTestId("foundry-contract")).toHaveCount(0);

  await activate(page, "Compile versioned contract");
  await expect(page.getByTestId("foundry-contract")).toContainText("2026-09-15T14:00:00.000Z");
  await expect(page.getByTestId("foundry-generated-world")).toHaveCount(0);

  await page.getByRole("tab", { name: "Validate & Preview" }).click();
  await expect(page.getByText("No generated records exist", { exact: true })).toBeVisible();
  const requestsBeforeGeneration = runtime.externalRequests.length;
  await activate(page, "Generate deterministic world");
  await expect(page.getByTestId("foundry-generated-world")).toContainText(
    "NO SALESFORCE CONNECTION OR CUSTOMER DATA",
  );
  expect(runtime.externalRequests).toHaveLength(requestsBeforeGeneration);
  const initialOutputHash = await generatedOutputHash(page);

  await expect(page.getByText("No privacy report. Generation alone is not a safety result.", { exact: true })).toBeVisible();
  await activate(page, "Run privacy validators");
  await expect(page.getByText("Privacy report", { exact: true }).locator("..")).toContainText("PASS");
  await expect(page.getByText("No quality report. Privacy validation alone is not a realism result.", { exact: true })).toBeVisible();
  await activate(page, "Run quality validators");
  await expect(page.getByText("Quality report", { exact: true }).locator("..")).toContainText("PASS");
  await expect(page.getByTestId("foundry-review-decision")).toHaveCount(0);
  await activate(page, "Submit pack for independent review");
  await expect(page.getByText(/Sofia Reyes cannot approve her own pack/i)).toBeVisible();

  await page.getByRole("tab", { name: "Rehearse" }).click();
  await expect(page.getByText("No review decision exists", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activate one demo session" })).toHaveCount(0);
  await activate(page, "Approve pack as Aisha Okafor");
  await expect(page.getByTestId("foundry-review-decision")).toContainText("Independent pack approval");
  await expect(page.getByTestId("foundry-activation-receipt")).toHaveCount(0);
  await activate(page, "Activate one demo session");
  await expect(page.getByTestId("foundry-activation-receipt")).toContainText("EVALUATION REQUIRED");
  await expect(page.getByLabel(/^NOT_READY:/)).toBeVisible();

  await activate(page, "Run four simulated evaluations");
  await expect(page.getByTestId("foundry-activation-receipt")).toContainText("READY");
  await expect(page.getByLabel(/^READY:/)).toBeVisible();
  for (const evaluation of [
    "Meeting preparation",
    "Deal health review",
    "Pipeline review",
    "Governed update",
  ]) {
    const card = page.getByRole("heading", {
      level: 3,
      name: new RegExp(`^${evaluation}$`, "i"),
    }).locator("..");
    await expect(card).toContainText("SIMULATED EVALUATION");
    await expect(card).toContainText("PASS");
  }
  await expect(page.getByTestId("scenario-foundry-view").getByText(/^Claude output$/i)).toHaveCount(0);
  await expect(page.getByTestId("scenario-foundry-view").getByText(/\bLIVE\b/)).toHaveCount(0);

  await page.getByRole("tab", { name: "Governance" }).click();
  const exportButton = page.getByRole("button", { name: "Export reviewed pack (.json)" });
  await expect(exportButton).toBeEnabled();
  expect(runtime.downloads).toHaveLength(0);
  const [firstDownload] = await Promise.all([
    page.waitForEvent("download"),
    exportButton.click(),
  ]);
  const firstExport = await downloadedText(firstDownload);
  const [secondDownload] = await Promise.all([
    page.waitForEvent("download"),
    exportButton.click(),
  ]);
  const secondExport = await downloadedText(secondDownload);
  expect(secondExport).toBe(firstExport);

  const exported = JSON.parse(firstExport) as ScenarioExport;
  expect(Object.keys(exported).sort()).toEqual([
    "contract",
    "groundTruthOracle",
    "provenanceManifest",
    "receiptLineage",
    "schemaVersion",
    "syntheticRecords",
    "validationSummaries",
  ]);
  expect(exported.schemaVersion).toBe(1);
  expect(exported.provenanceManifest.noSalesforceConnection).toBe(true);
  expect(exported.provenanceManifest.exportClassification).toBe("SYNTHETIC");
  expect(exported.syntheticRecords.contacts.every((contact) => contact.email.endsWith(".invalid"))).toBe(true);
  expect(firstExport).not.toMatch(/"(?:audit|draft|processedEventIds|exportStatus|feedbackCandidate|contextReceipt)"\s*:/);

  await page.getByRole("tab", { name: "Rehearse" }).click();
  await activate(page, "Apply capability v2 change");
  await expect(page.getByTestId("foundry-staleness-receipt")).toContainText("Pack is stale");
  await expect(page.getByTestId("foundry-staleness-receipt")).toContainText("runbook:model-access:v2");
  await expect(page.getByLabel(/^STALE:/)).toBeVisible();
  await expect(page.getByTestId("foundry-stage-rail").locator('[aria-current="step"]')).toContainText("Capability stale");
  await expect(page.getByTestId("foundry-activation-receipt")).toContainText("HISTORICAL");
  await expect(page.getByRole("button", { name: "Restore readiness" })).toHaveCount(0);

  await activate(page, "Run scoped revalidation");
  await expect(page.getByText("Bound revalidation report", { exact: true })).toBeVisible();
  await expect(page.getByTestId("foundry-stage-rail").locator('[aria-current="step"]')).toContainText("New evidence produced");
  await expect(page.getByText(/Current simulated oracle evidence:/)).toContainText("oracle-report:");
  await expect(page.getByLabel(/^STALE:/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore readiness" })).toHaveCount(0);

  await activate(page, "Approve revalidation evidence");
  await expect(page.getByTestId("foundry-revalidation-approval")).toContainText("APPROVED BY AISHA");
  await expect(page.getByTestId("foundry-stage-rail").locator('[aria-current="step"]')).toContainText("Evidence approved");
  await expect(page.getByLabel(/^STALE:/)).toBeVisible();
  await activate(page, "Restore readiness");
  await expect(page.getByLabel(/^READY:/)).toBeVisible();
  await expect(page.getByTestId("foundry-activation-receipt")).toContainText("runbook:model-access:v2");
  await expect(page.getByTestId("foundry-stage-rail").locator('[aria-current="step"]')).toContainText("Readiness restored");

  await page.setViewportSize({ width: 390, height: 844 });
  const populatedMobileOverflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(populatedMobileOverflow.scrollWidth).toBeLessThanOrEqual(populatedMobileOverflow.clientWidth);

  await activate(page, "Reset generated world");
  await expect(page.getByText(/Verified .*reset-receipt:/).first()).toBeVisible();
  await page.getByRole("tab", { name: "Validate & Preview" }).click();
  expect(await generatedOutputHash(page)).toBe(initialOutputHash);

  await page.getByRole("tab", { name: "Rehearse" }).click();
  await activate(page, "Verify teardown");
  const teardownEvidence = page.getByText(/Verified .*teardown-receipt:/).first();
  await expect(teardownEvidence).toBeVisible();
  const teardownReceipt = await teardownEvidence.textContent();
  await expect(page.getByLabel(/^DESTROYED:/)).toBeVisible();
  await expect(page.getByTestId("foundry-stage-rail").locator('[aria-current="step"]')).toContainText("Destroyed");

  await activate(page, "Verify teardown again");
  await expect(teardownEvidence).toHaveText(teardownReceipt ?? "");

  await activate(page, "Record inactive post-demo candidate");
  await expect(page.locator(".foundry-candidate")).toContainText("PROPOSED · INACTIVE:");
  await expect(page.locator(".foundry-candidate")).toContainText("cannot modify or activate");

  await page.getByRole("tab", { name: "Validate & Preview" }).click();
  await expect(page.getByTestId("foundry-generated-world")).toHaveCount(0);
  await expect(page.getByText("No generated records exist", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Governance" }).click();
  await expect(page.getByRole("row").filter({ hasText: /Teardown world/i })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Export reviewed pack (.json)" })).toBeDisabled();

  await page.getByRole("tab", { name: "Rehearse" }).click();
  await activate(page, "Start new pack · retain session audit");
  await expect(page.getByRole("tab", { name: "Build" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("group", { name: "Demo Brief" })).toBeFocused();
  await expect(page.getByText("No Context Receipt exists", { exact: true })).toBeVisible();
  await expect(page.getByTestId("foundry-contract")).toHaveCount(0);
  await expect(page.getByTestId("foundry-generated-world")).toHaveCount(0);
  await expect(page.getByTestId("foundry-review-decision")).toHaveCount(0);
  await expect(page.getByTestId("foundry-activation-receipt")).toHaveCount(0);

  expect(await page.evaluate(() => Object.keys(window.localStorage))).toEqual([]);
  const finalIndexedDatabases = await page.evaluate(async () =>
    (await window.indexedDB.databases()).map(({ name, version }) => ({ name, version })),
  );
  const withoutNextDevelopmentTooling = (databases: typeof finalIndexedDatabases) =>
    databases.filter(({ name }) => name !== "__next_debug_channel");
  expect(withoutNextDevelopmentTooling(finalIndexedDatabases)).toEqual(
    withoutNextDevelopmentTooling(initialIndexedDatabases),
  );
  expect(finalIndexedDatabases.some(({ name }) => /foundry|scenario|demoops/i.test(name ?? ""))).toBe(false);
  expect(await context.cookies()).toEqual([]);
  expectCleanRuntime(runtime);
});

test("the 390x844 experience exposes scrollable navigation without page overflow and honors reduced motion", async ({ page }) => {
  const runtime = auditRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lab#foundry");
  await expect(page.getByTestId("scenario-foundry-view")).toBeVisible();

  const pageOverflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(pageOverflow.scrollWidth).toBeLessThanOrEqual(pageOverflow.clientWidth);

  const planeNavigation = page.getByRole("navigation", { name: "Control plane" });
  const operationalTabs = page.getByRole("tablist", { name: "Operational planes" });
  const operationalTabWidth = await operationalTabs.evaluate((element) => element.scrollWidth);
  expect(operationalTabWidth).toBeGreaterThan(390);
  const navigationOverflow = await planeNavigation.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(navigationOverflow.scrollWidth).toBeGreaterThan(navigationOverflow.clientWidth);
  expect(navigationOverflow.overflowX).toMatch(/auto|scroll/);

  const foundryTabs = page.getByRole("tablist", { name: "Scenario Foundry views" });
  await expect(foundryTabs).toBeVisible();
  await expect(page.getByText(/More Foundry views/)).toBeVisible();
  const foundryTabOverflow = await foundryTabs.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, overflowX: getComputedStyle(element).overflowX }));
  expect(foundryTabOverflow.scrollWidth).toBeGreaterThan(foundryTabOverflow.clientWidth);
  expect(foundryTabOverflow.overflowX).toMatch(/auto|scroll/);

  const lifecycle = page.getByRole("list", { name: /Lifecycle evidence chronology/ });
  await expect(page.getByText(/More lifecycle evidence/)).toBeVisible();
  const lifecycleOverflow = await lifecycle.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, overflowX: getComputedStyle(element).overflowX }));
  expect(lifecycleOverflow.scrollWidth).toBeGreaterThan(lifecycleOverflow.clientWidth);
  expect(lifecycleOverflow.overflowX).toMatch(/auto|scroll/);
  await lifecycle.focus();
  await expect(lifecycle).toBeFocused();

  const build = page.getByRole("tab", { name: "Build" });
  await build.focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Governance" })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Governance" })).toHaveAttribute("id", "foundry-panel-governance");

  const transitionDuration = await page
    .getByRole("button", { name: "Export reviewed pack (.json)" })
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration) || 0);
  expect(transitionDuration).toBeLessThanOrEqual(0.001);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  expectCleanRuntime(runtime);
});

test("the foundry tour deep link opens on evidence, fails closed, and restores keyboard focus", async ({ page }) => {
  const runtime = auditRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lab?tour=foundry");

  const tour = page.getByRole("complementary", {
    name: "Scenario Foundry guided walkthrough",
  });
  await expect(tour).toBeVisible();
  await expect(page.getByRole("tab", { name: "Build" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#foundry-demo-brief")).toBeFocused();
  await expect.poll(async () => {
    const targetBox = await page.locator("#foundry-demo-brief").boundingBox();
    const tourBox = await tour.boundingBox();
    const viewport = page.viewportSize();
    return Boolean(targetBox && tourBox && viewport
      && targetBox.y >= tourBox.y + tourBox.height + 8
      && targetBox.y < viewport.height);
  }).toBe(true);

  const next = page.getByRole("button", { name: "Next evidence" });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#foundry-context-firewall")).toBeFocused();
  await expect(page.getByRole("button", { name: "Complete visible action" })).toBeDisabled();

  await page.getByRole("button", { name: "Issue safe Context Receipt" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Next evidence" })).toBeFocused();

  const close = page.getByRole("button", { name: "Close Scenario Foundry walkthrough" });
  await close.focus();
  await page.keyboard.press("Enter");
  await expect(tour).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open guided walkthrough" })).toBeFocused();
  await expect.poll(() => new URL(page.url()).searchParams.has("tour")).toBe(false);
  await page.getByRole("tab", { name: /Command Center/ }).click();
  await page.getByRole("tab", { name: /Scenario Foundry/ }).click();
  await expect(page.getByRole("complementary", { name: "Scenario Foundry guided walkthrough" })).toHaveCount(0);
  expectCleanRuntime(runtime);
});

test("the complete evidence-gated tour drives the same reducer path by keyboard", async ({ page }) => {
  const runtime = auditRuntime(page);
  await page.goto("/lab?tour=foundry");
  const tour = page.getByRole("complementary", { name: "Scenario Foundry guided walkthrough" });
  await expect(tour).toBeVisible();
  await expect(page.getByRole("tab", { name: "Build" })).toHaveAttribute("aria-selected", "true");
  const target = async (id: string, accessibleName: string) => {
    const region = page.getByRole("group", { name: accessibleName });
    await expect(region).toHaveAttribute("id", id);
    await expect(region).toBeFocused();
    await expect.poll(async () => {
      const box = await region.boundingBox();
      const tourBox = await tour.boundingBox();
      const viewport = page.viewportSize();
      return Boolean(box && tourBox && viewport
        && box.y >= tourBox.y + tourBox.height + 8
        && box.y < viewport.height);
    }).toBe(true);
  };
  const pressFocused = async (name: string) => {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");
  };
  const advanceTo = async (id: string, accessibleName: string) => {
    await pressFocused("Next evidence");
    await target(id, accessibleName);
  };

  await target("foundry-demo-brief", "Demo Brief");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await advanceTo("foundry-context-firewall", "Context Firewall");
  await page.keyboard.press("Tab");
  await pressFocused("Issue safe Context Receipt");
  await advanceTo("foundry-world-blueprint", "World Blueprint");
  await page.keyboard.press("Tab");
  await pressFocused("Compile versioned contract");
  await advanceTo("foundry-generated-world", "Generated World");
  await page.keyboard.press("Tab");
  await pressFocused("Generate deterministic world");
  await advanceTo("foundry-privacy-quality", "Privacy and Quality");
  await page.keyboard.press("Tab");
  await pressFocused("Run privacy validators");
  await pressFocused("Run quality validators");
  await pressFocused("Submit pack for independent review");
  await advanceTo("foundry-activation", "Pack Review and Activation");
  await page.keyboard.press("Tab");
  await pressFocused("Approve pack as Aisha Okafor");
  await pressFocused("Activate one demo session");
  await advanceTo("foundry-oracle", "Known-answer Oracle");
  await page.keyboard.press("Tab");
  await pressFocused("Run four simulated evaluations");
  await advanceTo("foundry-staleness", "Capability Change and Staleness");
  await page.keyboard.press("Tab");
  await pressFocused("Apply capability v2 change");
  await advanceTo("foundry-revalidation", "Scoped Revalidation");
  await page.keyboard.press("Tab");
  await pressFocused("Run scoped revalidation");
  await pressFocused("Approve revalidation evidence");
  await pressFocused("Restore readiness");
  await advanceTo("foundry-lifecycle-controls", "Activation Reset Expiration and Teardown");
  await page.keyboard.press("Tab");
  await pressFocused("Reset generated world");
  await advanceTo("foundry-lifecycle-controls", "Activation Reset Expiration and Teardown");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await pressFocused("Verify teardown");
  await advanceTo("foundry-provenance", "Scenario Provenance");

  await expect(page.getByRole("tab", { name: "Governance" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  const finish = page.getByRole("button", { name: "Finish walkthrough" });
  await expect(finish).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tour).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open guided walkthrough" })).toBeFocused();
  expectCleanRuntime(runtime);
});
