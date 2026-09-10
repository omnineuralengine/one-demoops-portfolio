# Private source, public demo: release preparation

**Target: a private GitHub repository and a public Vercel demonstration.** This folder's name does not determine repository visibility. No source publication, push, remote connection, Vercel project link, deployment, protection change, or history rewrite has been performed.

**Local status: READY for first deployment.** All current local checks passed after aligning Node.js and adding public third-party notices. No unresolved application or build blocker was found. This is not certification of a deployed site: the account and project checks below remain unverified, a live URL is pending the first authorized deployment, and remote GitHub checks are pending the first authorized push.

## Reviewed application boundary

This snapshot contains application routes, components, typed rules, tests, source-checking tools, bounded public-source artifacts, synthetic fixtures, locked dependencies, non-secret configuration, and documentation. Data under `src/generated/change-radar/` is reviewed application input with recorded dates, not compiled output.

The original private history, hosting link, credentials, personal records, setup prompts, private notes, archived prototype, dependency folders, build output, logs, screenshots, and test traces are excluded from the reviewed commit. This is a separate Git repository on `main` without remotes. Its initial packaging identity is `ONE Release Preparation <release@example.invalid>`; the scoped follow-up commit uses the machine's existing configured Git identity. Neither statement verifies GitHub or Vercel authorization, and the original commit is retained without rewriting history. Generated validation files and independently installed dependencies are kept in a separate temporary validation workspace after testing, outside the release folder.

Visitors receive the application, browser code, and synthetic data, without access to the private repository or administrative accounts. Decisions stay in browser memory; explicit fictional exports save a file to the visitor's device. No browser route invokes source-checking scripts. See [security boundaries](SECURITY.md).

## Vercel build settings

These settings come from the repository. No existing Vercel dashboard or account configuration was inspected or changed.

| Setting | Value for this application |
| --- | --- |
| Framework preset | Next.js; installed version 16.3.4 using App Router |
| Root directory | Repository root, `.` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Framework-managed Next.js output; local build directory is `.next`. Leave the output-directory override unset |
| Node.js | `24.x`, matching `package.json` and the lockfile root; local checks and GitHub workflow use 24.18.0 |
| Required application environment values | None |
| Optional values | `ONE_ALLOW_ANALYTICS=false` and `ONE_ALLOW_INDEXING=false` by default |
| Hosting-provided values | `NODE_ENV`, `VERCEL`, `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL`, and `VERCEL_URL`; use the new host's system variables, not values copied from the original project |
| Routing | `/` and `/briefing` open the briefing; `/lab?tour=1` opens the journey; `/about`, `/notices`, `/robots.txt`, and `/opengraph-image` use native Next.js routes. Unknown paths return 404; no custom rewrites or base path |
| Additional configuration | No `vercel.json` is needed for these Next.js defaults |

The Next.js preset manages build output. [Vercel build configuration](https://vercel.com/docs/deployments/configure-a-build) documents these settings. Vercel supports Node.js 24.x and manages minor/patch updates; confirm the actual hosted patch in the first build log. [Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

Analytics require explicit opt-in plus production hosting markers; local and preview builds remain off. No analytics credential or project identifier is included. Leave both optional switches off for the initial visitor check. Hosting-provider request logs are separate.

Confirm that Vercel's system environment variables are exposed to the build so metadata uses the actual production hostname. Local metadata falls back to localhost; no hosted URL has been invented. [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables)

## Current independent local validation

This folder has its own installation; dependencies and build output are not borrowed from the original project. The local host uses Windows, Node.js 24.18.0, and npm 11.16.0. GitHub Actions now selects Node.js 24.18.0; its first remote Linux run remains pending.

| Current revision check | Result |
| --- | --- |
| `npm ci` | Passed: 445 packages installed in approximately 46 seconds; audit reported zero known vulnerabilities |
| Workflow installation command | `npm ci --ignore-scripts --no-audit --no-fund` passed locally in approximately 48 seconds |
| Installed lint dependency graph | `npm ls` exited 0 for the inspected lint packages; pinned peer relationships are valid |
| `npm run lint` | Passed with zero warnings |
| `npm run typecheck` | Route generation and TypeScript passed |
| `npm test` | 33 files; 240 tests passed in 54.90 seconds |
| `npm run radar:validate` | Passed |
| `npm run build` | Passed; all 9 static pages generated, including `/notices` |
| `npm run test:e2e` | 11 Chromium tests passed against this folder's production build in 25.4 seconds |
| `/notices` response and footer link | Passed keyboard Tab/Enter navigation, HTTP 200, plain-text/nosniff headers, and exact inclusion of all six preserved runtime notice inputs; output is prerendered with no revalidation |
| Local production routing | All seven listed routes returned 200; missing page, `/.env`, `/.git/config`, and `/docs/RELEASE.md` returned 404 |
| Browser smoke check | Zero page errors or external HTTP requests; no cookies, local/session storage, IndexedDB entries, or horizontal overflow at 390px. Desktop/mobile screenshots inspected |
| Final incremental source and asset review | 11 changed/new files, 13 production static assets, and 7 HTML/notice outputs reviewed; no credential, private-account-link, or personal-path findings |
| Original project preservation | Rechecked all 184 original source-file hashes: identical, no additions, Git status unchanged |

The install reported the ESLint end-of-life warning below and a local npm policy warning for `unrs-resolver`'s optional postinstall. No script permission was broadened. Warnings are recorded separately from check failures; no completed current check above failed.

### Earlier snapshot evidence

These prior results establish a baseline, not validation of the current Node.js declaration and notices changes:

| Earlier check | Recorded evidence |
| --- | --- |
| Production build | Passed; 8 static pages generated |
| Chromium browser suite | 10 tests passed in 32.9 seconds |
| Documented local commands | Development and production commands on port 3201 served the briefing; production `/briefing`, `/about`, and `/lab` returned 200 |
| Visitor behavior | No browser errors or external HTTP requests on checked main routes; no cookies, local/session storage, or IndexedDB entries |
| Source and client assets | Reviewed 190 eligible files, 13 production static assets, and 6 production HTML files; no credential, private-account-link, or personal-path findings |
| Third-party notices | 18 direct license/notice files and 130 bundled Next.js notices matched independently installed dependencies |
| Original project | All 184 original tracked/untracked source files retained identical SHA-256 hashes; no additions and unchanged Git status |

The browser suite covers the complete journey, approval versus verification, keyboard focus, 320px/390px reduced-motion layouts, pause/reconsider, reset/refresh, free exploration, scenario generation, and explicit fictional exports. It confirms that the first simulated check fails, runbook v2 approval alone does not activate the correction, replay passes, a separate human closes the work, and Restart journey returns to the initial state. Unit tests cover authority guards, export filtering, source handling, and workflow restrictions.

## Unresolved development maintenance: ESLint

The lockfile retains ESLint 9.39.5. Version 9 reached upstream end of life on August 6, 2026; version 10 is the current supported major. This remains a development-maintenance risk even when lint passes and the audit reports no known vulnerability. [ESLint version support](https://eslint.org/version-support/)

Official package metadata checked on September 10, 2026 reports ESLint 10.10.0 as latest. Although `eslint-config-next@16.3.4` accepts ESLint `>=9.0.0`, its latest plugin dependencies exclude version 10:

| Current plugin | Declared ESLint peer range |
| --- | --- |
| `eslint-plugin-import@2.32.0` | `^2 || ^3 || ^4 || ^5 || ^6 || ^7.2.0 || ^8 || ^9` |
| `eslint-plugin-jsx-a11y@6.10.2` | `^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9` |
| `eslint-plugin-react@7.37.5` | `^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7` |

Sources: official registry metadata for [ESLint](https://registry.npmjs.org/eslint/latest), [Next.js lint configuration](https://registry.npmjs.org/eslint-config-next/latest), [import rules](https://registry.npmjs.org/eslint-plugin-import/latest), [accessibility rules](https://registry.npmjs.org/eslint-plugin-jsx-a11y/latest), and [React rules](https://registry.npmjs.org/eslint-plugin-react/latest).

No supported drop-in ESLint 10 upgrade preserving these rules was established. No forced install, peer bypass, rule removal, or lint-configuration dependency change was made. Revisit compatible upstream versions or review a scoped replacement separately.

This is **not an automatic deployment blocker**: no repository policy requires current upstream support, and Next.js 16's build does not run lint. The explicit lint command and read-only workflow remain required validation gates; a failing gate would block readiness. [Next.js 16 lint changes](https://nextjs.org/docs/app/guides/upgrading/version-16#next-lint-command)

## Licensing and visitor notices

DemoOps source stays private. Selecting an open-source license for DemoOps is outside this hosting task and is not a prerequisite imposed by this release process. No new project license was selected. The Apache 2.0 decision for the separate ONE-job-loop project does not apply to DemoOps.

Third-party terms remain independent and preserved in [third-party notices](../THIRD_PARTY_NOTICES.md) and `licenses/`. The footer links to a static `GET /notices` response, making runtime dependency notices available to visitors while the repository stays private. Its locally verified 279,797-byte response retains all six runtime notice inputs, including the bundled Next.js notices and their upstream attribution. It publishes notice text without publishing private repository documents. Hosted delivery remains pending first deployment.

Upstream notice bytes retain their original line endings and whitespace through `.gitattributes`; they are not reformatted for a whitespace check. This review is not a comprehensive license-compatibility certification.

## Actual deployment blockers and pending checks

No unresolved local deployment blocker was found, and no local check failed. No Vercel deployment has failed because none has been attempted. The following hosting conditions remain unverified; a failure in an applicable authorization, plan, protection, or required-check gate must be resolved before deployment proceeds:

- **Connection:** no remote or Vercel project is linked. Verify the intended private repository, narrowly scoped integration access, target project, and production branch when deployment is authorized.
- **Plan eligibility:** a private repository owned by a GitHub organization cannot connect to a Vercel Hobby team. Repository ownership and Vercel plan are unknown, so this is conditional. Keep the intended repository private. [Vercel private repository rules](https://vercel.com/docs/git#deploying-private-git-repositories)
- **Commit-author eligibility:** verify the configured author's GitHub/Vercel association and authorization for the selected integration. The initial neutral packaging identity is not a linked deployment identity; the follow-up uses existing Git configuration without claiming verified platform access. Do not fabricate an identity or rewrite history to pass this check. [Vercel Git authorization](https://vercel.com/docs/git#deploying-private-git-repositories)
- **Dashboard and visitor access:** confirm build settings, environment values, applicable deployment protection, and intended public-demo access. No existing protection was inspected or changed; this report does not instruct disabling it.
- **First deployment:** verify the actual URL, routes including `/notices`, journey/reset, and visitor network behavior before adding a live-demo link. The live URL remains pending.
- **First push:** the included workflow only validates; it saves no checkout credentials and has no remote-write or deployment job. Its Linux execution remains pending. Local Windows success cannot certify remote execution.

Physical devices, screen-reader speech, Firefox, and Safari remain unverified. Establish an appropriate reporting contact for the hosted lab. Validation needs no private account, provider call, or live source synchronization.

## Reproduce local checks

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run radar:validate
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite starts this copy's production build on its own port and refuses to reuse an existing server. `ONE_E2E_PORT` can select another unused test port.

After building, `npm run start -- --hostname 127.0.0.1 --port 3201` starts a local production copy. Stop any development server using that port first. These commands validate locally; they do not publish or deploy.
