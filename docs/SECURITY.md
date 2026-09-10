# Security and privacy boundaries

This source release contains a synthetic demonstration. It has no credentials, database, authentication service, private-account connection, provider integration, or public endpoint for administrative actions. The people and authority checks are role-play; they are not a security system for managing real users.

## Visitor data

Interactions change browser memory only. Refresh clears the session. Restart clears the guided rehearsal; free exploration preserves it within the same session. The application does not save visitor decisions to cookies, browser storage, a server, or a shared database.

The Scenario Foundry accepts a bounded set of fictional business characteristics. It excludes uploads, real records, arbitrary fields, and free text. Its explicit download rebuilds and validates an allowlisted fictional document; that file persists on the visitor’s device. A rejected value is not echoed into an export or log. These boundaries reduce disclosure risk; they are not an anonymization or regulatory-compliance claim.

Do not enter real personal, customer, or organizational data when customizing the fixtures. Keep access checks and approval guards intact. Approval never substitutes for an implemented executor or passing verification.

## Network boundary

The core demonstration makes no model, identity, customer, or administrative service request. Opening an official-source link is a visitor action to a public website, outside this application.

The optional maintainer command `npm run docs:check` performs public network requests separately from the browser. The collector checks official hosts, path prefixes, redirects, timeouts, response bounds, and source availability. It needs no authentication. It writes bounded source metadata and excerpts for human review; it does not persist full response bodies. No browser-accessible route can start it.

Third-party page-view analytics are **off by default**. They require all of `ONE_ALLOW_ANALYTICS=true`, `NODE_ENV=production`, `VERCEL=1`, and `VERCEL_ENV=production`. Local and preview builds do not activate them. No hosting-project identifier, deployment connection, account token, or analytics credential is shipped. If the eventual owner enables analytics, review consent, URL contents, retention, and the new hosting project’s configuration before sharing it. Hosting providers may also retain their own request logs.

Search indexing is off unless `ONE_ALLOW_INDEXING=true`. The included `.env.example` contains only these non-secret switches. Normal local operation needs no environment file.

## Source and automation

Public references, authored rehearsal wording, inferred impact, role-play approvals, and simulated verification are labeled separately. A fixture hash proves reproducibility of authored input; it does not prove a real source changed or a live demo works.

The included GitHub workflow only installs locked dependencies and validates the application. Its token has read-only content access, checkout does not save credentials, and it has no secrets, publishing job, source-fetch schedule, remote writes, or deployment step. Dependency and browser downloads are part of development checks, not visitor behavior. The older repository’s source-publication workflow and account binding are absent.

The application contains no private Git history. This folder starts from a new, reviewed source snapshot with a neutral packaging identity and no remote. Installation and validation outputs are excluded from the committed release.

## Reporting a concern

No public issue tracker or private reporting address has been established for this unhosted release. Do not invent one or send sensitive evidence to an unrelated product’s support team. The eventual publisher must establish a reporting contact before accepting real vulnerability reports. Keep any discovered secret out of screenshots, issues, and public logs; revoke it at its source before further distribution.

See [release evidence and limitations](RELEASE.md). The review is bounded and is not a guarantee that every possible security or licensing issue has been discovered.
