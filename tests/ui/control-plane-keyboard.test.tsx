import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createSyntheticState } from "@/data/synthetic/seed";
import { ControlPlaneApp } from "@/features/command-center/ControlPlaneApp";

describe("control plane keyboard navigation", () => {
  it("moves from Command Center to Missions with the documented Alt+5 shortcut", async () => {
    window.history.replaceState(null, "", "/lab");
    const user = userEvent.setup();

    render(
      <ControlPlaneApp
        initialState={createSyntheticState()}
      />,
    );

    expect(screen.getByRole("tab", { name: /command center/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(document.getElementById("plane-panel-command")).toHaveAttribute("aria-labelledby", "plane-tab-command");
    expect(document.getElementById("plane-panel-glossary")).toHaveAttribute("hidden");

    await user.keyboard("{Alt>}5{/Alt}");

    expect(screen.getByRole("tab", { name: /missions/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Missions" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Missions selected");
    expect(window.location.hash).toBe("#missions");
  });

  it("keeps the causal human decision in the same state after switching planes", async () => {
    window.history.replaceState(null, "", "/lab");
    const user = userEvent.setup();
    render(
      <ControlPlaneApp
        initialState={createSyntheticState()}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /change radar/i }));
    await user.click(screen.getByRole("button", { name: "Accept for synthetic assessment" }));
    expect(screen.getByText("CHANGE ACCEPTED")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: /command center/i }));
    await user.click(screen.getByRole("tab", { name: /change radar/i }));

    expect(screen.getByText("CHANGE ACCEPTED")).toBeVisible();
    expect(screen.getByText(/Human review decision review:change:/)).toBeVisible();
  });

  it("supports roving arrow, Home, and End navigation for operational planes", async () => {
    window.history.replaceState(null, "", "/lab");
    const user = userEvent.setup();
    render(<ControlPlaneApp initialState={createSyntheticState()} />);
    const command = screen.getByRole("tab", { name: /command center/i });
    command.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /agent swarm/i })).toHaveFocus();
    expect(screen.getByRole("heading", { level: 1, name: "Agent Swarm" })).toBeVisible();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: /scenario foundry/i })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(command).toHaveFocus();
  });

  it("adds Scenario Foundry as the ninth governed plane without changing existing numeric shortcuts", async () => {
    window.history.replaceState(null, "", "/lab");
    const user = userEvent.setup();
    render(<ControlPlaneApp initialState={createSyntheticState()} />);

    const foundry = screen.getByRole("tab", { name: /scenario foundry/i });
    expect(foundry).toHaveAttribute("aria-controls", "plane-panel-foundry");

    await user.keyboard("{Alt>}9{/Alt}");

    expect(foundry).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { level: 1, name: /Scenario Foundry Synthetic Revenue Worlds/i })).toBeVisible();
    expect(window.location.hash).toBe("#foundry");
  });
});
