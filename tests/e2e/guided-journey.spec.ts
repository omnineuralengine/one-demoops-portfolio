import { expect, test, type Locator, type Page } from "@playwright/test";

const journeyName = "90-second guided tour";
const responsePath = [
  "Reveal affected work",
  "Choose a response",
  "Rehearse a safe fallback",
  "Accept for synthetic assessment",
  "Claim as Maya",
  "Approve scope as Mateo",
  "Approve check plan as Aisha",
  "Continue to verification",
  "Run simulated check",
  "Approve runbook v2 as Mateo",
  "Replay simulated check",
  "Review the handoff",
  "Close with passing evidence as Priya",
] as const;

function auditRuntime(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const externalRequests: string[] = [];
  const mutationRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!/^https?:$/.test(url.protocol)) return;
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) externalRequests.push(request.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) mutationRequests.push(`${request.method()} ${url.pathname}`);
  });
  return () => {
    expect(consoleErrors, "browser console errors").toEqual([]);
    expect(pageErrors, "uncaught browser errors").toEqual([]);
    expect(externalRequests, "journey must not fetch public sources or providers in the browser").toEqual([]);
    expect(mutationRequests, "journey must not send mutations to any server").toEqual([]);
  };
}

async function tabTo(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  for (let count = 0; count < 45; count += 1) {
    if (await control.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(control, "control must be reachable by Tab").toBeFocused();
  const outline = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
  });
  expect(outline.style, "keyboard focus must have a visible outline").not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
}

async function keyboardActivate(page: Page, name: string) {
  const control = journeyButton(page, name);
  await tabTo(page, control);
  await page.keyboard.press("Enter");
}

function journeyButton(page: Page, name: string) {
  return page.getByRole("complementary", { name: journeyName }).getByRole("button", {
    name: name === "Rehearse a safe fallback" ? /^Rehearse a safe fallback/ : name,
    exact: true,
  });
}

async function expectFits(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(widths.page, "document must not overflow horizontally").toBeLessThanOrEqual(widths.viewport + 1);
}

test("keyboard journey separates recorded evidence, inference, human approval and simulated verification", async ({ page }) => {
  const expectCleanRuntime = auditRuntime(page);
  await page.goto("/lab?tour=1");
  const journey = page.getByRole("complementary", { name: journeyName });
  await expect(journey).toBeVisible();
  await expect(journey.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(journey).toContainText("Recorded public reference");
  await expect(journey).toContainText(/illustrative/i);
  await expect(journey.locator('a[href^="https://platform.claude.com/"]')).toBeVisible();
  await tabTo(page, journey.locator("summary").filter({ hasText: "Source evidence & fixture provenance" }));
  await page.keyboard.press("Enter");
  await expect(journey.locator("blockquote")).toBeVisible();
  await expect(journey.locator('time[datetime="2026-01-05"]')).toBeVisible();
  await expect(journey).toContainText("No historical page snapshot or fresh source diff is claimed.");
  await expect(journey).toContainText("Model selection is checked during rehearsal setup.");
  await expect(journey).toContainText("Effective model entitlement must be checked before a rehearsal begins.");
  await expect(journey.getByText("Fixture hash before", { exact: true })).toBeVisible();

  await keyboardActivate(page, "Reveal affected work");
  await expect(journey).toContainText(/inferred/i);
  await expect(journey).toContainText(/Maya/);
  await expect(journey).toContainText(/runbook/i);
  await keyboardActivate(page, "Choose a response");
  await expect(journey.getByRole("button", { name: /^Rehearse a safe fallback/ })).toHaveAttribute("aria-pressed", "false");
  await expect(journey.getByRole("button", { name: "Accept for synthetic assessment" })).toHaveCount(0);
  await keyboardActivate(page, "Rehearse a safe fallback");
  await keyboardActivate(page, "Accept for synthetic assessment");
  await expect(journey).toContainText(/Leila/);
  await expect(journey).toContainText(/evidence/i);
  await expect(journey).toContainText(/uncertain|uncertainty|missing/i);
  await keyboardActivate(page, "Claim as Maya");
  await keyboardActivate(page, "Approve scope as Mateo");
  await keyboardActivate(page, "Approve check plan as Aisha");
  await expect(journey.getByRole("button", { name: /Close with passing evidence/ })).toHaveCount(0);
  await keyboardActivate(page, "Continue to verification");
  await expect(journey.getByRole("button", { name: "Review the handoff" })).toHaveCount(0);
  await keyboardActivate(page, "Run simulated check");
  await expect(journey).toContainText(/fail/i);
  await expect(journey.getByRole("button", { name: /Close with passing evidence/ })).toHaveCount(0);
  await keyboardActivate(page, "Approve runbook v2 as Mateo");
  await expect(journey).toContainText(/not active|inactive|v1 remains active/i);
  await keyboardActivate(page, "Replay simulated check");
  await expect(journey).toContainText(/pass/i);
  await keyboardActivate(page, "Review the handoff");
  await expect(journey).toContainText(/simulat/i);
  await expect(journey).toContainText(/next/i);
  await tabTo(page, journey.locator("summary").filter({ hasText: "Inspect evidence, lineage & human decisions" }));
  await page.keyboard.press("Enter");
  await expect(journey.locator("details[open]")).toContainText("receipt:work:mission:change:");
  await expect(journey.locator("details[open]")).toContainText("runbook:model-access:v2");
  await keyboardActivate(page, "Close with passing evidence as Priya");
  await expect(journey).toContainText("Resolved in simulation");
  await keyboardActivate(page, "Finish & explore the control plane");
  await expect(journey).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.has("tour")).toBe(false);
  expectCleanRuntime();
});

test("pause, reconsider, reset, refresh and free exploration preserve the correct boundaries", async ({ page }) => {
  const expectCleanRuntime = auditRuntime(page);
  await page.goto("/lab?tour=1");
  const journey = page.getByRole("complementary", { name: journeyName });
  await journey.getByRole("button", { name: "Reveal affected work" }).click();
  await journey.getByRole("button", { name: "Choose a response" }).click();
  await journey.getByRole("button", { name: /^Hold for more evidence/ }).click();
  await journey.getByRole("button", { name: "Pause this journey" }).click();
  await expect(journey).toContainText(/no.*(?:work|approval)|unresolved|not resolved/i);
  await journey.getByRole("button", { name: "Reconsider response" }).click();
  await journey.getByRole("button", { name: /^Rehearse a safe fallback/ }).click();
  await journey.getByRole("button", { name: "Accept for synthetic assessment" }).click();
  await journey.getByRole("button", { name: "Claim as Maya" }).click();
  await journey.getByRole("button", { name: "Explore freely" }).click();
  await expect(journey).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Team Operations", level: 1 })).toBeVisible();
  await expect(page.getByText("OWNED", { exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has("tour")).toBe(false);
  await page.getByRole("button", { name: "Start guided journey", exact: true }).click();
  await expect(journey.getByRole("button", { name: "Reveal affected work" })).toBeVisible();
  for (const name of responsePath.slice(0, 5)) await journeyButton(page, name).click();
  await journey.getByRole("button", { name: "Restart journey" }).click();
  await expect(journey.getByRole("button", { name: "Reveal affected work" })).toBeVisible();
  await expect(journey.getByRole("heading", { level: 1 })).toBeFocused();
  await journey.getByRole("button", { name: "Explore freely" }).click();
  await expect(journey).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.has("tour")).toBe(false);
  await page.getByRole("tab", { name: /team operations/i }).click();
  await expect(page.getByText("No change-driven work exists")).toBeVisible();
  await page.getByRole("button", { name: "Start guided journey", exact: true }).click();
  for (const name of responsePath.slice(0, 5)) await journeyButton(page, name).click();
  await page.reload();
  await expect(journey.getByRole("button", { name: "Reveal affected work" })).toBeVisible();
  await journey.getByRole("button", { name: "Explore freely" }).click();
  await page.getByRole("tab", { name: /team operations/i }).click();
  await expect(page.getByText("No change-driven work exists")).toBeVisible();
  expectCleanRuntime();
});

for (const width of [390, 320]) {
  test(`the complete journey remains usable at ${width}px with reduced motion`, async ({ page }) => {
    const expectCleanRuntime = auditRuntime(page);
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/lab?tour=1");
    const journey = page.getByRole("complementary", { name: journeyName });
    await expect(journey).toBeVisible();
    await journey.locator("summary").filter({ hasText: "Source evidence & fixture provenance" }).click();
    await expect(journey.locator("blockquote")).toBeVisible();
    await expectFits(page);
    await journey.locator("summary").filter({ hasText: "Source evidence & fixture provenance" }).click();
    for (const name of responsePath) {
      await expectFits(page);
      if (name === "Close with passing evidence as Priya") {
        await journey.locator("summary").filter({ hasText: "Inspect evidence, lineage & human decisions" }).click();
        await expect(journey.locator("details[open]")).toContainText("runbook:model-access:v2");
        await expectFits(page);
      }
      const button = journeyButton(page, name);
      await expect(button).toBeVisible();
      const bounds = await button.boundingBox();
      expect(bounds?.height, `${name} needs a usable touch target`).toBeGreaterThanOrEqual(44);
      await button.click();
    }
    await expect(journey).toContainText("Resolved in simulation");
    await expectFits(page);
    const restart = journey.getByRole("button", { name: "Restart journey" });
    await tabTo(page, restart);
    const transition = await restart.evaluate((element) => Math.max(...getComputedStyle(element).transitionDuration.split(",").map((value) => Number.parseFloat(value) || 0)));
    expect(transition).toBeLessThanOrEqual(0.001);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await page.keyboard.press("Enter");
    await expect(journey.getByRole("button", { name: "Reveal affected work" })).toBeVisible();
    await expectFits(page);
    expectCleanRuntime();
  });
}
