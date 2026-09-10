import { ShieldCheck } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import type { AgentPermissionMode } from "@/lib/domain/types";

const boundaries: Array<{
  mode: AgentPermissionMode;
  allowed: string;
  boundary: string;
  tone: StatusTone;
}> = [
  { mode: "OBSERVE_ONLY", allowed: "Read allowlisted synthetic signals", boundary: "Cannot recommend, propose, or execute", tone: "info" },
  { mode: "RECOMMEND_ONLY", allowed: "Draft a recommendation or artifact", boundary: "Cannot create an executable proposal", tone: "amethyst" },
  { mode: "EXECUTE_LOW_RISK", allowed: "Run explicit reversible checks", boundary: "Cannot inherit consequential authority", tone: "success" },
  { mode: "HUMAN_APPROVAL_REQUIRED", allowed: "Propose an exact target and operation", boundary: "Execution needs a current single-use receipt", tone: "warning" },
  { mode: "DISABLED", allowed: "No operation", boundary: "No observation, proposal, or execution authority", tone: "neutral" },
];

export function AuthorityMatrix() {
  return (
    <section className="authority-matrix" aria-label="Agent authority contract">
      <SectionHeading
        icon={ShieldCheck}
        title="Authority contract"
        description="The vocabulary is closed: cards derive from these five modes, and runtime checks enforce the same boundary."
      />
      <Panel className="data-table-panel">
        <div
          className="table-scroll"
          role="region"
          tabIndex={0}
          aria-label="Agent authority matrix; scroll horizontally if needed"
        >
          <table>
            <thead><tr><th>Permission mode</th><th>May do</th><th>Hard stop</th></tr></thead>
            <tbody>
              {boundaries.map((boundary) => (
                <tr key={boundary.mode}>
                  <td><StatusPill tone={boundary.tone}>{boundary.mode.replaceAll("_", " ")}</StatusPill></td>
                  <td>{boundary.allowed}</td>
                  <td>{boundary.boundary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}
