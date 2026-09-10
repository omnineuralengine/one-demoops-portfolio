import { useReducer } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GuidedTour } from "@/features/shell/GuidedTour";
import { causalLoopReducer, createDeterministicLoopAction, createGoldenLoopRun, type ActorKind, type LoopAction, type LoopRun } from "@/features/causal-loop";

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

function renderJourney() {
  const onClose = vi.fn();
  function Harness() {
    const [loop, dispatch] = useReducer(causalLoopReducer, undefined, createGoldenLoopRun);
    const onAction = (type: LoopAction["type"], actorId: string, kind: ActorKind) => {
      dispatch(createDeterministicLoopAction(loop, type, actorId, kind));
    };
    return <>
      <GuidedTour
        loop={loop}
        onAction={onAction}
        onRestart={() => onAction("RESET", "priya", "HUMAN")}
        onClose={onClose}
      />
      <output data-testid="loop-state">{JSON.stringify(loop)}</output>
    </>;
  }
  render(<Harness />);
  return { user: userEvent.setup(), onClose };
}

function currentRun(): LoopRun {
  return JSON.parse(screen.getByTestId("loop-state").textContent ?? "null") as LoopRun;
}

async function advance(user: ReturnType<typeof userEvent.setup>, count: number) {
  for (const name of responsePath.slice(0, count)) {
    await user.click(screen.getByRole("button", { name: name === "Rehearse a safe fallback" ? /^Rehearse a safe fallback/ : name }));
  }
}

describe("90-second guided journey", () => {
  it("lets a human pause and reconsider without creating work or approval", async () => {
    const { user } = renderJourney();
    await advance(user, 2);
    const hold = screen.getByRole("button", { name: /^Hold for more evidence/ });
    await user.click(hold);
    expect(hold).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Pause this journey" }));
    expect(currentRun()).toEqual(createGoldenLoopRun());
    expect(screen.queryByRole("button", { name: "Close with passing evidence as Priya" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reconsider response" }));
    await user.click(screen.getByRole("button", { name: /^Rehearse a safe fallback/ }));
    await user.click(screen.getByRole("button", { name: "Accept for synthetic assessment" }));
    expect(currentRun()).toMatchObject({
      phase: "CHANGE_ACCEPTED",
      reviewDecision: { acceptedBy: "aisha" },
      workItem: { claimedBy: null },
      mission: { state: "DRAFT" },
      receipts: [],
    });
  });

  it("requires ownership, separate approvals, a failed check, approved learning and passing replay before closure", async () => {
    const { user } = renderJourney();
    await advance(user, 4);
    expect(screen.queryByRole("button", { name: "Approve scope as Mateo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue to verification" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Claim as Maya" }));
    expect(currentRun().workItem?.claimedBy).toBe("maya");
    await user.click(screen.getByRole("button", { name: "Approve scope as Mateo" }));
    expect(currentRun().mission?.approvedBy).toBe("mateo");
    await user.click(screen.getByRole("button", { name: "Approve check plan as Aisha" }));
    expect(currentRun()).toMatchObject({ phase: "PLAN_APPROVED", receipts: [], closedBy: null });
    await user.click(screen.getByRole("button", { name: "Continue to verification" }));
    expect(screen.queryByRole("button", { name: "Review the handoff" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run simulated check" }));
    expect(currentRun().receipts.map((receipt) => receipt.outcome)).toEqual(["FAIL"]);
    expect(screen.queryByRole("button", { name: "Close with passing evidence as Priya" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve runbook v2 as Mateo" }));
    expect(currentRun()).toMatchObject({ phase: "RUNBOOK_APPROVED", activeRunbookVersionId: "runbook:model-access:v1", closedBy: null });
    expect(currentRun().learningRecord?.state).toBe("PROPOSED");
    await user.click(screen.getByRole("button", { name: "Replay simulated check" }));
    expect(currentRun().receipts.map((receipt) => receipt.outcome)).toEqual(["FAIL", "PASS"]);
    expect(currentRun()).toMatchObject({ phase: "REPLAY_PASSED", activeRunbookVersionId: "runbook:model-access:v2", closedBy: null });
    await user.click(screen.getByRole("button", { name: "Review the handoff" }));
    await user.click(screen.getByRole("button", { name: "Close with passing evidence as Priya" }));
    expect(currentRun()).toMatchObject({ phase: "CLOSED", closedBy: "priya", workItem: { state: "CLOSED" } });
    expect(currentRun().audit.every((record) => record.outcome === "ACCEPTED")).toBe(true);
  });

  it.each(responsePath.map((name, index) => [name, index + 1] as const))(
    "restarts after %s with no stale decisions, receipts, runbook or screen state",
    async (_name, count) => {
      const { user } = renderJourney();
      await advance(user, count);
      await user.click(screen.getByRole("button", { name: "Restart journey" }));
      expect(currentRun()).toEqual(createGoldenLoopRun());
      expect(screen.getByRole("button", { name: "Reveal affected work" })).toBeVisible();
      expect(screen.queryByRole("button", { name: "Reconsider response" })).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveFocus());
    },
  );

  it("clears a paused choice on restart and provides free exploration", async () => {
    const { user, onClose } = renderJourney();
    await advance(user, 2);
    await user.click(screen.getByRole("button", { name: /^Hold for more evidence/ }));
    await user.click(screen.getByRole("button", { name: "Pause this journey" }));
    await user.click(screen.getByRole("button", { name: "Restart journey" }));
    await advance(user, 2);
    expect(screen.getByRole("button", { name: /^Rehearse a safe fallback/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^Hold for more evidence/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Accept for synthetic assessment" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Explore freely" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(currentRun()).toEqual(createGoldenLoopRun());
  });
});
