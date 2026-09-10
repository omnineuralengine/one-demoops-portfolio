import { expect, test } from "@playwright/test";

test("briefing opens the command center and starts a guided mission", async ({ page }) => {
  await page.goto("/briefing");

  await expect(
    page.getByRole("heading", { level: 1, name: /ONE DemoOps Control Plane/i }),
  ).toBeVisible();
  await expect(page.getByRole("note")).toContainText(
    "Independent, synthetic demonstration built from publicly available information.",
  );

  await page
    .getByRole("main")
    .getByRole("link", { name: "Open control plane" })
    .click();

  await expect(page).toHaveURL(/\/lab$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Command Center" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /command center/i }),
  ).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: /missions/i }).click();

  await expect(page).toHaveURL(/\/lab#missions$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Missions" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Start Guided mission" }).first().click();

  await expect(page.getByTestId("mission-player")).toBeVisible();
  await expect(page.getByText(/GUIDED .* seed/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit" })).toBeVisible();
});

test("deterministic change closes only after approved learning and passing replay", async ({ page }) => {
  await page.goto("/lab#changes");
  await expect(page.getByText("Not an Anthropic internal event")).toBeVisible();
  await expect(page.getByText(/No mission, work item, handoff, stale runbook/)).toBeVisible();
  await expect(page.getByText(/review:change:/)).toHaveCount(0);

  await page.getByRole("button", { name: "Accept for synthetic assessment" }).click();
  await expect(page.getByText(/Human review decision review:change:/)).toBeVisible();

  await page.getByRole("tab", { name: /team operations/i }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Team Operations" })).toBeVisible();
  await expect(page.getByText(/Awaiting claim by Maya Chen/)).toBeVisible();
  await expect(page.getByText("work:mission:change:bffcb5c9f00cf34956139cad9c3718e3", { exact: true })).toBeVisible();
  const assignmentMetric = page.locator(".metric-card").filter({ hasText: "My causal assignments" });
  const [labelBox, valueBox, detailBox] = await Promise.all([
    assignmentMetric.locator(".metric-card__label").boundingBox(),
    assignmentMetric.locator(".metric-card__value").boundingBox(),
    assignmentMetric.locator(".metric-card__detail").boundingBox(),
  ]);
  expect(labelBox).not.toBeNull();
  expect(valueBox?.y).toBeGreaterThanOrEqual((labelBox?.y ?? 0) + (labelBox?.height ?? 0));
  expect(detailBox?.y).toBeGreaterThanOrEqual((valueBox?.y ?? 0) + (valueBox?.height ?? 0));
  await page.getByRole("button", { name: "Claim this exact work item" }).click();
  await expect(page.getByText("OWNED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve draft mission scope" }).click();
  await page.getByRole("button", { name: "Approve reversible verification plan" }).click();
  await expect(page.getByText(/No receipt before approved check/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Close with passing evidence/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Run local deterministic check" }).click();
  await expect(page.getByText(/FAIL · attempt 1/)).toBeVisible();

  await page.getByRole("tab", { name: "Knowledge Spine" }).click();
  await expect(page.getByText("PROPOSED · HUMAN APPROVAL REQUIRED")).toBeVisible();
  await expect(page.getByText(/Runbook v1 predicts/)).toBeVisible();
  await expect(page.locator(".knowledge-list").getByRole("heading", { name: /v2/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Approve lesson and append runbook v2" }).click();
  await expect(page.getByText("RUNBOOK V2 APPROVED · NOT ACTIVE")).toBeVisible();
  await expect(page.locator(".knowledge-list").filter({ hasText: /v2/ })).toContainText("APPROVED · REPLAY REQUIRED");
  await page.getByRole("button", { name: "Replay against runbook v2" }).click();
  await expect(page.getByText(/Objective replay passed/)).toBeVisible();
  await expect(page.locator(".knowledge-list").filter({ hasText: /v2/ })).toContainText("ACTIVE");
  await expect(page.getByText("ACTIVE · PASSING EVIDENCE ATTACHED")).toBeVisible();

  await page.getByRole("tab", { name: /command center/i }).click();
  await expect(page.getByText(/VERIFIED · Passing receipt receipt:work:mission:change:bffcb5c9f00cf34956139cad9c3718e3:replay/)).toBeVisible();
  await page.getByRole("button", { name: "Close with passing evidence" }).click();
  await expect(page.getByText("CLOSED").last()).toBeVisible();
  await expect(page.getByText(/PASS · 2\/2 controls passed/)).toBeVisible();
  await expect(page.getByText("Insufficient observations").first()).toBeVisible();

  await page.getByRole("button", { name: "Reset deterministic rehearsal" }).click();
  await expect(page.getByText("OBSERVED").last()).toBeVisible();
  await page.getByRole("tab", { name: /team operations/i }).click();
  await expect(page.getByText("No change-driven work exists")).toBeVisible();
  await page.getByRole("tab", { name: "Knowledge Spine" }).click();
  await expect(page.getByText("No verification receipt exists.")).toBeVisible();
  await expect(page.locator(".knowledge-list").getByRole("heading", { name: /v2/ })).toHaveCount(0);
});
