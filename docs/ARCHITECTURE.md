# How this lab is built

This application makes a change understandable by connecting its evidence, affected work, owner, response, and verification. It uses a small, deterministic simulation so visitors can inspect the same decision sequence without credentials, provider spending, or operational access.

## Architecture

The existing stack is Next.js with React and TypeScript. Server routes compose the pages and pass checked, repository-backed public-source data into the interactive control plane. A shared React provider owns the simulation in browser memory. Typed reducers control accepted state changes; selectors derive readiness, access, and other views from that state.

```text
Recorded public context + authored rehearsal
                         |
                         v
Review -> ownership -> approvals -> simulated verification -> human closure
                         |
                         v
Shared in-memory state -> connected views and inspectable evidence
```

The tour is a focused view of the same causal-loop reducer used elsewhere in the control plane. It does not have a second shortcut that can approve or resolve work independently.

| Location | Responsibility |
| --- | --- |
| `app/` | Landing, briefing, lab, build notes, metadata, and shared styles. |
| `components/` | Reusable controls, panels, and page elements. |
| `features/command-center/ControlPlaneProvider.tsx` | Shared interactive state and action dispatch. |
| `features/shell/GuidedTour.tsx` | Guided navigation, explanation, and response preview. |
| `features/causal-loop/` | Review, handoff, verification, learning, and closure rules. |
| `lib/domain/` and `lib/selectors/` | Operational simulation rules and derived results. |
| `features/scenario-foundry/` | Bounded fictional scenario generation, validation, and explicit export. |
| `data/synthetic/` | Fictional operational examples. |
| `data/change-radar/registry.ts` | Public-source allowlist and collection policy. |
| `scripts/change-radar/` | Local source collection, comparison, and artifact validation. |
| `tests/` | Domain, workflow, interaction, and browser checks. |

## Evidence and human boundaries

The guided journey keeps four different claims visible:

- **Recorded public context:** a dated, manually reviewed public release note. It is not a fresh observation.
- **Inferred impact:** a hypothesis connecting that reference to fictional demos, permissions, and learning material.
- **Human approval:** the visitor role-plays named fictional reviewers to accept work, approve scope, and approve a check.
- **Verified outcome:** deterministic checks produce simulated receipts; a passing replay is required before a separate human closure.

The exercise's before/after content is authored. Its hashes fingerprint that authored input, not a captured historical public-page difference. Real model availability does not establish a fictional presenter's access.

Agent panels model bounded observation and proposals. Only implemented, guarded local actions can run; recording approval cannot create an executor or grant real authority. Actor names are role-play, not authentication. The lab has no authenticated collaboration, private-account connection, provider call, or external administrative mutation.

## Data and persistence

Interactive decisions, audit records, learning, and scenario packs stay in browser memory. Refresh clears them. The journey's restart control resets its rehearsal; free exploration preserves that rehearsal while moving among views.

A visitor can explicitly download a validated fictional scenario as a JSON file. That file persists on their device until they remove it. No background export or upload is performed.

The application reads source artifacts already included in the repository. It exposes no browser endpoint for fetching sources. An optional local maintainer command uses network access:

```sh
npm run docs:check
npm run radar:validate
```

The checker fetches allowlisted public pages, holds bounded response bodies in process memory, then writes metadata, hashes, limited excerpts, change events, and source health under `src/generated/change-radar/`. It does not retain full response bodies. Failed source requests remain visible as failures. Review generated changes before committing them; inferred impact is not permission to change policy.

Analytics are disabled by default. Enabling them requires an explicit server configuration choice and production hosting. See [security and privacy boundaries](SECURITY.md) before changing that setting. Search indexing is also disabled by default.

## Tradeoffs and customization

In-memory state makes reset simple and prevents a shared visitor database. It also means work cannot survive a refresh or synchronize across devices. Deterministic fixtures make checks repeatable; their passing results say nothing about a live customer environment.

Use fictional records when changing `data/synthetic/` or `features/team-operations/fixtures/`. Keep source provenance separate from the authored inputs in `features/causal-loop/public-reference.ts` and `rehearsal-input.ts`. Update reducer tests when changing approval or verification rules. Visual tokens live in `app/globals.css`; retain visible focus, text status labels, and reduced-motion behavior.

Adding a real integration would require a new design for credentials, authorization, data handling, and verification. No existing simulation control is an integration-ready permission boundary.

## Run and verify

Node.js 22.22.2 or newer and npm are required. From the repository root:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run radar:validate
npm run build
```

For browser tests, install the test browser once if it is not already available:

```sh
npx playwright install chromium
npm run test:e2e
```

These tests exercise the guided journey, reset, keyboard navigation, narrow layouts, and the scenario workflow. See the [release validation report](RELEASE.md) for results from the reviewed release copy, rather than treating the presence of tests as proof they passed.

To run the production build locally after `npm run build`:

```sh
npm run start -- --hostname 127.0.0.1 --port 3201
```

Open [the briefing](http://127.0.0.1:3201/briefing). Stop any development server using that port first. Local operation needs no environment file. Port 3201 is simply the local address used for this copy.
