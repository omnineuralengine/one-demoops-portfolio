# Security and privacy boundaries

This public portfolio contains a synthetic demonstration. It has no application credentials, database, authentication service, private-account connection, model-provider integration, or public endpoint for administrative actions. The people and authority checks are role-play; they are not a security system for managing real users.

## Visitor data

Interactions change browser memory only. Refresh clears the session. Restart clears the guided rehearsal; free exploration preserves it within the same session. The application does not save visitor decisions to cookies, browser storage, a server, or a shared database.

The Scenario Foundry accepts a bounded set of fictional business characteristics. It excludes uploads, real records, arbitrary fields, and free text. Its explicit download rebuilds and validates an allowlisted fictional document; that file persists on the visitor’s device. A rejected value is not echoed into an export or log. These boundaries reduce disclosure risk; they are not an anonymization or regulatory-compliance claim.

Do not enter real personal, customer, or organizational data when customizing the fixtures. Keep access checks and approval guards intact. Approval never substitutes for an implemented executor or passing verification.

## Network boundary

The core demonstration makes no model, identity, customer, or administrative service request. Opening an official-source link is a visitor action to a public website, outside this application.

The portfolio repository and hosted demo are public. Original project code has no open-source license; third-party terms remain separate. The read-only `/notices` route serves a fixed list of preserved third-party notices, rendered at build time. It accepts no file path from visitors and does not expose repository documents, Git metadata, or environment values through the application.

The optional maintainer command `npm run docs:check` performs public network requests separately from the browser. The collector checks official hosts, path prefixes, redirects, timeouts, response bounds, and source availability. It needs no authentication. It writes bounded source metadata and excerpts for human review; it does not persist full response bodies. No browser-accessible route can start it.

Vercel pageview analytics are explicitly enabled for this production demo. The source defaults remain **off**: the root layout requires all of `ONE_ALLOW_ANALYTICS=true`, `NODE_ENV=production`, `VERCEL=1`, and `VERCEL_ENV=production` at build time. Local and preview builds do not activate analytics. The client filter accepts pageviews only and removes query strings and fragments from tracked page URLs. Custom events are disabled, and simulation decisions, exports, and fictional records are not added to analytics payloads. No analytics credential is required in application source. Hosting providers may also retain their own request logs; filtering application analytics does not change those logs.

The SDK reads incoming referrers independently of the tracked page URL. The client therefore suppresses pageview events when `document.referrer` contains a query string, fragment, or URL credentials, and when `navigator.webdriver` identifies an automated browser. The analytics script can still load on production pages whose events are suppressed. A `no-referrer` metadata policy also prevents this application's page URL from being sent as an outgoing referrer. These controls reduce disclosure and test traffic; they do not anonymize hosting-provider logs.

Search indexing is off unless `ONE_ALLOW_INDEXING=true`. The included `.env.example` contains only these non-secret switches. Normal local operation needs no environment file.

## Source and automation

Public references, authored rehearsal wording, inferred impact, role-play approvals, and simulated verification are labeled separately. A fixture hash proves reproducibility of authored input; it does not prove a real source changed or a live demo works.

The included GitHub workflow only installs locked dependencies and validates the application. Its token has read-only content access, checkout does not save credentials, and it has no secrets, publishing job, source-fetch schedule, remote writes, or deployment step. Dependency and browser downloads are part of development checks, not visitor behavior. The older repository’s source-publication workflow and account binding are absent.

This repository began from a reviewed source snapshot, separate from the original private Git history. It is now published as a public portfolio. Installation, deployment account configuration, and validation outputs are excluded from source control.

## Reporting a concern

This document does not designate a private reporting address. Use a repository maintainer's published contact when available; do not send sensitive evidence to an unrelated product's support team. Keep any discovered secret out of screenshots, public issues, and logs; revoke it at its source before further distribution.

See [release evidence and limitations](RELEASE.md). The review is bounded and is not a guarantee that every possible security or licensing issue has been discovered.
