import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "How I built this",
  description: "Architecture, tradeoffs, tests, and human boundaries in the ONE DemoOps lab.",
};

export default function AboutPage() {
  return (
    <div className="about-page">
      <p className="eyebrow">The working model</p>
      <h1>How I built this</h1>
      <p>
        Start with a person responding to a change: understand the evidence, find the affected
        work, agree on an owner, and verify the response. The architecture follows that workflow.
      </p>
      <div className="about-stack">
        <article>
          <h2>One connected state, small modules</h2>
          <p>
            Next.js renders the public pages and loads bounded source artifacts. React reducers
            own the interactive simulation. Typed rules connect identity, permissions, demos,
            handoffs, and readiness, so a decision has visible consequences across views.
          </p>
          <details className="about-details">
            <summary>Inspect the architecture</summary>
            <dl className="about-file-map">
              <div><dt><code>app/</code></dt><dd>Server routes and public-safe data loading.</dd></div>
              <div><dt><code>lib/domain/</code></dt><dd>State transitions; selectors derive access and readiness.</dd></div>
              <div><dt><code>features/causal-loop/</code></dt><dd>One shared review, ownership, verification, and learning lifecycle.</dd></div>
              <div><dt><code>scripts/change-radar/</code></dt><dd>Separate allowlisted public-source collection and validation.</dd></div>
            </dl>
          </details>
        </article>
        <article>
          <h2>Evidence has a provenance</h2>
          <p>
            The tour uses a clearly labeled recorded fixture with synthetic changed content.
            Repository-backed public-source records retain their collection timestamps and
            source health. Impact mapping is an inference to review, never a fresh observation
            or a statement about a real team.
          </p>
        </article>
        <article>
          <h2>Local by default, deliberately bounded</h2>
          <p>
            Deterministic fixtures make the same response repeatable without credentials or
            provider spending. Simulation state lives in browser memory and resets on refresh.
            The tradeoff is intentional: there is no durable history or authenticated collaboration.
            Optional public-source collection runs outside the visitor’s browser.
          </p>
        </article>
        <article>
          <h2>People authorize. Agents stay within scope.</h2>
          <p>
            Modeled agents surface evidence, suggest actions, and run bounded local checks.
            Named fictional humans accept changes, own handoffs, approve plans and learning,
            and close work. Approval cannot grant an unimplemented executor or substitute for
            passing verification. Every action stays inside the simulation.
          </p>
        </article>
        <article>
          <h2>Test the boundaries and the workflow</h2>
          <p>
            Vitest checks permission intersections, approval guards, source validation, and
            deterministic lifecycle transitions. Testing Library exercises keyboard interaction;
            Playwright follows the journey in a real browser, including reset and evidence-gated
            closure. These checks establish behavior within the model, not production reliability.
          </p>
          <details className="about-details">
            <summary>View the local checks</summary>
            <p><code>npm run lint</code> · <code>npm run typecheck</code> · <code>npm test</code> · <code>npm run test:e2e</code> · <code>npm run build</code></p>
          </details>
        </article>
      </div>
      <div className="action-row">
        <Link className="primary-link" href="/lab?tour=1">
          Try the 90-second journey <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link className="secondary-link" href="/briefing">Back to briefing</Link>
      </div>
    </div>
  );
}
