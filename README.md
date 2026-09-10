# ONE DemoOps Control Plane

ONE DemoOps Control Plane is an interactive lab about keeping product demonstrations dependable. Follow a change through affected people, a response, and evidence that the response worked.

## Try it

No verified hosted demo is available yet. Run it below, then open [the local briefing](http://127.0.0.1:3201/briefing).

## What to try first

1. Click **Start the 90-second tour**. Inspect a dated public release note and the separately labeled, authored before/after example.
2. Click **Reveal affected work**. See how one change can affect a demo, permissions, learning material, and fictional owners.
3. Click **Choose a response**. Compare rehearsing a safe fallback with holding for more evidence; then follow the handoff, approvals, failed check, corrected instructions, and passing replay.

Approval alone cannot resolve the exercise: passing simulated evidence and human closure are separate steps. **Restart journey** clears the rehearsal; **Explore freely** keeps its current state while opening the wider lab.

## Run your own copy

Install Node.js **24.x** and npm. In this folder, run:

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3201
```

No account, paid service, or environment file is required. See [architecture and checks](docs/ARCHITECTURE.md) for production commands and tests.

## Make it yours

Edit fictional examples in `data/synthetic/`, team ownership in `features/team-operations/fixtures/`, and the guided exercise in `features/causal-loop/`. Adjust shared colors and spacing in `app/globals.css`. The [architecture guide](docs/ARCHITECTURE.md) explains the boundaries to preserve.

## What is real, and what stays local?

The public-source links and recorded reference are real; people, organizations, incidents, metrics, approvals, agents, and verification outcomes are simulated. The exercise's changed text is authored, not a captured historical difference or fresh observation.

Interactive state lives in browser memory and clears on refresh. Explicit scenario exports save a fictional file to your device. Optional command-line source checks fetch public pages and write source metadata locally. The demo does not sign in to private accounts, call model providers, or change external systems. Analytics are off unless explicitly enabled for production hosting. A passing simulation proves only its fixture.

## Attribution and license

Built with ONE, the Omni Neural Engine. The repository stays private; the hosted demo is public. DemoOps has no open-source license. Apache-2.0 for ONE-job-loop does not apply here. Preserve [third-party notices](THIRD_PARTY_NOTICES.md). See [release evidence and maintenance limits](docs/RELEASE.md).

> Independent, synthetic demonstration built from publicly available information. Not affiliated with Anthropic and not representative of Anthropic’s internal systems or architecture.
