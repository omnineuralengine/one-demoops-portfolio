import Link from "next/link";
import { ArrowRight, Info, ShieldCheck } from "lucide-react";

const evidenceStages = [
  ["Observed change", "Inspect the source, recorded timestamp, and before / after evidence."],
  ["Inferred impact", "Trace the connection to demos, permissions, learning material, and fictional owners."],
  ["Human decision", "Choose a response, review the handoff, and keep someone accountable."],
  ["Verified outcome", "Run a simulated check. Approval alone cannot make the work resolved."],
] as const;

export function Briefing() {
  return (
    <div className="briefing-page">
      <section className="briefing-hero" aria-labelledby="briefing-title">
        <div>
          <p className="eyebrow">An independent systems lab · Built with ONE</p>
          <h1 id="briefing-title">
            ONE DemoOps
            <span>Control Plane</span>
          </h1>
          <p className="hero-copy">
            A change is not just an alert. It affects demos, people, permissions, learning
            material, and decisions—and someone must own the response.
          </p>
          <div className="action-row">
            <Link className="primary-link" href="/lab?tour=1">
              Start the 90-second tour <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="secondary-link" href="/lab">
              Open control plane
            </Link>
          </div>
          <p className="briefing-tour-note">
            Recorded fixture · Fictional team · No credentials · Restart anytime
          </p>
          <div className="disclaimer" role="note">
            <Info size={17} aria-hidden="true" />
            <span>
              Independent, synthetic demonstration built from publicly available information.
              Not affiliated with Anthropic and not representative of Anthropic’s internal
              systems or architecture.
            </span>
          </div>
        </div>

        <aside className="briefing-card" aria-label="Follow one change">
          <p className="eyebrow">The 90-second journey</p>
          <h2>Follow one change.<br />Understand the whole response.</h2>
          <ol className="briefing-evidence-path">
            {evidenceStages.map(([title, explanation], index) => (
              <li key={title}>
                <span className="briefing-evidence-path__index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div><h3>{title}</h3><p>{explanation}</p></div>
              </li>
            ))}
          </ol>
          <p className="briefing-human-boundary">
            <ShieldCheck size={17} aria-hidden="true" />
            Evidence informs. People decide. Verification earns closure.
          </p>
        </aside>
      </section>

      <section className="briefing-followup" aria-label="Explore the lab">
        <article>
          <p className="eyebrow">Why this matters</p>
          <h2>Make the next person’s job easier.</h2>
          <p>
            An alert is useful when someone can explain what changed, who may be affected,
            what is still uncertain, and what happens next. This lab makes that handoff visible.
          </p>
          <Link className="briefing-text-link" href="/about">
            How I built this <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </article>
        <article>
          <p className="eyebrow">Free exploration</p>
          <h2>Follow your own questions.</h2>
          <p>
            Explore demo readiness, effective access, agent boundaries, and the learning loop
            in the control plane. Or try the existing governed Scenario Foundry.
          </p>
          <Link className="briefing-text-link" href="/lab?tour=foundry">
            Explore the Scenario Foundry <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </article>
      </section>
    </div>
  );
}
