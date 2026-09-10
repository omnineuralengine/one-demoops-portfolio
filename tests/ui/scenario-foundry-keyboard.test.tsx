import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createSyntheticState } from "@/data/synthetic/seed";
import { ControlPlaneApp } from "@/features/command-center/ControlPlaneApp";

function renderFoundry() {
  window.history.replaceState(null, "", "/lab#foundry");
  render(<ControlPlaneApp initialState={createSyntheticState()} />);
}

describe("Scenario Foundry keyboard and tab semantics", () => {
  it("provides roving focus and complete tab-to-tabpanel relationships", async () => {
    const user = userEvent.setup();
    renderFoundry();

    const build = await screen.findByRole("tab", { name: "Build" });
    const validate = screen.getByRole("tab", { name: "Validate & Preview" });
    const rehearse = screen.getByRole("tab", { name: "Rehearse" });
    const governance = screen.getByRole("tab", { name: "Governance" });

    const expectedRelationships = [
      [build, "foundry-panel-build", "foundry-tab-build"],
      [validate, "foundry-panel-validate", "foundry-tab-validate"],
      [rehearse, "foundry-panel-rehearse", "foundry-tab-rehearse"],
      [governance, "foundry-panel-governance", "foundry-tab-governance"],
    ] as const;

    for (const [tab, panelId, tabId] of expectedRelationships) {
      const panel = document.getElementById(panelId);
      expect(tab).toHaveAttribute("id", tabId);
      expect(tab).toHaveAttribute("aria-controls", panelId);
      expect(panel).toHaveAttribute("role", "tabpanel");
      expect(panel).toHaveAttribute("aria-labelledby", tabId);
    }

    expect(build).toHaveAttribute("aria-selected", "true");
    expect(build).toHaveAttribute("tabindex", "0");
    expect(validate).toHaveAttribute("tabindex", "-1");
    expect(document.getElementById("foundry-panel-build")).not.toHaveAttribute("hidden");
    expect(document.getElementById("foundry-panel-validate")).toHaveAttribute("hidden");

    build.focus();
    await user.keyboard("{ArrowRight}");
    expect(validate).toHaveFocus();
    expect(validate).toHaveAttribute("aria-selected", "true");
    expect(document.getElementById("foundry-panel-validate")).not.toHaveAttribute("hidden");

    await user.keyboard("{End}");
    expect(governance).toHaveFocus();
    expect(document.getElementById("foundry-panel-governance")).not.toHaveAttribute("hidden");

    await user.keyboard("{Home}");
    expect(build).toHaveFocus();
    expect(document.getElementById("foundry-panel-build")).not.toHaveAttribute("hidden");

    await user.keyboard("{ArrowLeft}");
    expect(governance).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(build).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(governance).toHaveFocus();
  });

  it("opens on the exact first tour target, gates advancement on evidence, and restores opener focus", async () => {
    const user = userEvent.setup();
    renderFoundry();

    const governance = await screen.findByRole("tab", { name: "Governance" });
    await user.click(governance);

    const opener = screen.getByRole("button", { name: "Open guided walkthrough" });
    expect(opener).toHaveAttribute("aria-controls", "foundry-guided-tour");
    opener.focus();
    await user.keyboard("{Enter}");

    const tour = await screen.findByRole("complementary", {
      name: "Scenario Foundry guided walkthrough",
    });
    expect(tour).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Build" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(document.getElementById("foundry-demo-brief")).toBeVisible();
      expect(screen.getByRole("group", { name: "Demo Brief" })).toHaveFocus();
    });

    const inTourAudience = screen.getByRole("combobox", { name: "Demo audience" });
    inTourAudience.focus();
    await user.selectOptions(inTourAudience, "EXECUTIVE_REVIEW");
    await waitFor(() => expect(inTourAudience).toHaveFocus());

    const firstNext = screen.getByRole("button", { name: "Next evidence" });
    firstNext.focus();
    await user.keyboard("{Enter}");

    const gated = screen.getByRole("button", { name: "Complete visible action" });
    expect(gated).toBeDisabled();
    await waitFor(() => {
      expect(document.getElementById("foundry-context-firewall")).toHaveFocus();
    });

    const issueReceipt = screen.getByRole("button", {
      name: "Issue safe Context Receipt",
    });
    issueReceipt.focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByTestId("foundry-context-receipt")).toBeVisible();
    await waitFor(() => expect(screen.getByRole("button", { name: "Next evidence" })).toHaveFocus());

    const close = screen.getByRole("button", {
      name: "Close Scenario Foundry walkthrough",
    });
    close.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(
        screen.queryByRole("complementary", {
          name: "Scenario Foundry guided walkthrough",
        }),
      ).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    });
  });

  it("moves focus to named evidence after a phase-changing control disappears", async () => {
    const user = userEvent.setup();
    renderFoundry();
    const issueReceipt = await screen.findByRole("button", { name: "Issue safe Context Receipt" });
    issueReceipt.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.getByRole("group", { name: "Context Firewall" })).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Issue safe Context Receipt" })).not.toBeInTheDocument();
    expect(screen.getByText(/Accept Context accepted: Safe Context Accepted/i)).toBeInTheDocument();
  });

  it("retains focus on persistent structured controls while their typed edits invalidate descendants", async () => {
    const user = userEvent.setup();
    renderFoundry();

    const audience = await screen.findByRole("combobox", { name: "Demo audience" });
    audience.focus();
    await user.selectOptions(audience, "EXECUTIVE_REVIEW");
    await waitFor(() => expect(audience).toHaveFocus());

    const assistedMode = screen.getByRole("radio", { name: /Safe-pattern-assisted/ });
    assistedMode.focus();
    await user.keyboard(" ");
    await waitFor(() => expect(assistedMode).toHaveFocus());
    expect(assistedMode).toBeChecked();
  });
});
