import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useReducer, useState } from "react";
import { describe, expect, it } from "vitest";
import { causalLoopReducer, createDeterministicLoopAction, createGoldenLoopRun, type LoopAction, type LoopRun } from "@/features/causal-loop";
import { TeamOperationsView, type TeamView } from "@/features/team-operations/TeamOperationsView";

function Harness({ initial }: { initial: LoopRun }) {
  const [loop, dispatch] = useReducer(causalLoopReducer, initial);
  const [view, setView] = useState<TeamView>("cockpit");
  const act = (type: LoopAction["type"], actorId: string, kind: "HUMAN" | "AGENT") => dispatch(createDeterministicLoopAction(loop, type, actorId, kind));
  return <TeamOperationsView loop={loop} view={view} onViewChange={setView} onLoopAction={act} />;
}

describe("Team Operations keyboard actions", () => {
  it("claims the exact accepted work item from the keyboard", async () => {
    const user = userEvent.setup();
    const observed = createGoldenLoopRun();
    const accepted = causalLoopReducer(observed, createDeterministicLoopAction(observed, "ACCEPT_CHANGE", "aisha", "HUMAN"));
    render(<Harness initial={accepted} />);

    const button = screen.getByRole("button", { name: "Claim this exact work item" });
    button.focus();
    await user.keyboard("{Enter}");

    expect(screen.getAllByText(/Maya Chen$/).length).toBeGreaterThan(0);
    expect(screen.getByText("OWNED")).toBeVisible();
  });

  it("supports Arrow, Home, and End navigation across team tabs", async () => {
    const user = userEvent.setup();
    render(<Harness initial={createGoldenLoopRun()} />);
    const cockpit = screen.getByRole("tab", { name: "My Cockpit" });
    expect(cockpit).toHaveAttribute("aria-controls", "team-panel-cockpit");
    expect(document.getElementById("team-panel-knowledge")).toHaveAttribute("hidden");
    cockpit.focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Team Field" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "team-panel-field");

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Knowledge Spine" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(cockpit).toHaveFocus();
  });
});
