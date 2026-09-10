import { Activity, BookOpen } from "lucide-react";
import type { SystemHealth } from "@/lib/domain/types";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";

const terms = [
  ["Effective access", "The permissions left after organization policy, role policy, identity, seat, workspace, effort, and tool limits are all intersected."],
  ["Blocking layer", "The narrowest policy or system layer currently denying the required capability."],
  ["Blast radius", "The users, demos, systems, or policies a change can affect beyond the immediate problem."],
  ["Approval receipt", "A time-bounded, exact-scope record of who approved which consequential action and why."],
  ["Bounded loop", "An operational loop with a trigger, goal, budget, verification step, human checkpoint, and explicit terminal condition."],
  ["Control plane", "The place where state, policy, decisions, and evidence are coordinated; it is not the underlying provider system."],
  ["Synthetic", "Deterministic fictional data created for learning and demonstration, not copied from a real organization."],
  ["Preflight", "A read-only readiness check run before a demo to expose dependencies and blocking conditions early."],
  ["Provenance", "Where a request or action came from, such as a presenter, mission, preflight, or diagnostic agent."],
  ["Human boundary", "The required progression from observation and recommendation through approval before high-impact execution."],
  ["Change Radar", "A read-only comparison of selected public official sources that produces short, reviewable change metadata."],
  ["Claudeforce", "The expanded strategic partnership between Salesforce and Anthropic. It is not a merger."],
] as const;

export function GlossaryView({ systems }: { systems: SystemHealth[] }) {
  return (
    <div className="plane-view" data-testid="glossary-view">
      <section className="plane-intro">
        <div>
          <p className="eyebrow">Explainable by design</p>
          <h1>Glossary</h1>
          <p>Plain language for the operating concepts and causal systems used throughout the lab.</p>
        </div>
      </section>
      <SectionHeading
        icon={BookOpen}
        title="Operating concepts"
        description="The concepts behind the interface, written for technical and customer-facing readers."
      />
      <div className="glossary-grid">
        {terms.map(([term, definition]) => (
          <Panel as="article" className="glossary-card" key={term}>
            <h3>{term}</h3>
            <p>{definition}</p>
          </Panel>
        ))}
      </div>

      <SectionHeading
        icon={Activity}
        title="System reference"
        description="The causal systems carried forward from the original synthetic simulator."
      />
      <div className="glossary-grid">
        {systems.map((system) => (
          <Panel as="article" className="glossary-card" key={system.id}>
            <h3>{system.name}</h3>
            <p>{system.description}</p>
            <small>{system.whyItMatters}</small>
          </Panel>
        ))}
      </div>
    </div>
  );
}
