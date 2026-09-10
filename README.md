# ONE DemoOps Control Plane

**[Open the live portfolio demo](https://one-demoops-control-plane-public-re.vercel.app/)**

DemoOps teaches how to keep product demonstrations dependable when something changes. Follow a public release note, see who and what could be affected, choose a response, and check whether it worked. Built with ONE, the Omni Neural Engine, this interactive portfolio lab makes each decision and result visible.

## Take the 90-second tour

1. Open the demo and click **Start the 90-second tour**. Inspect a dated public release note and the separately labeled, authored before/after example.
2. Click **Reveal affected work** to see the connection between a demo, permissions, learning material, and fictional owners.
3. Click **Choose a response**. Compare rehearsing a safe fallback with holding for more evidence, then follow the handoff, approvals, failed check, corrected instructions, and passing replay.

Approval alone cannot resolve the exercise: passing simulated evidence and human closure are separate steps. **Restart journey** clears the rehearsal; **Explore freely** preserves it while opening the wider lab.

## Run locally

Install Node.js **24.x** and npm, then run:

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3201
```

Open [the local briefing](http://127.0.0.1:3201/briefing). No account, paid service, or environment file is required. The [architecture guide](docs/ARCHITECTURE.md) covers implementation boundaries, fixture locations, production commands, and tests.

## Data and analytics

Public-source links and recorded references are real. People, organizations, incidents, metrics, approvals, agents, and verification outcomes are simulated. Changed text is authored, not a captured historical difference or fresh observation. A passing simulation proves only its fixture.

Interactive state stays in browser memory and clears on refresh. Explicit scenario exports save fictional files to your device. Optional maintainer commands fetch public pages separately from the browser. The demo does not access private accounts or call model providers.

Production hosting enables Vercel pageview analytics through an explicit environment setting. Tracked page URLs exclude query strings and fragments; custom events are disabled. Automated visits and visits with sensitive referrers are skipped. Local and preview builds keep analytics off. Hosting-provider request logs are separate. See [security boundaries](docs/SECURITY.md).

## Attribution and license

This is a public portfolio repository. **Original project code has no open-source license**; public availability does not grant an open-source license. Third-party dependencies retain their own terms and [notices](THIRD_PARTY_NOTICES.md). See [release evidence and limitations](docs/RELEASE.md).

> Independent, synthetic demonstration built from publicly available information. Not affiliated with Anthropic and not representative of Anthropic’s internal systems or architecture.
