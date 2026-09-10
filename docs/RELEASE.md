# Public portfolio: release configuration and evidence

**Live demo: [ONE DemoOps Control Plane](https://one-demoops-control-plane-public-re.vercel.app/).** This is a public portfolio repository with a public Vercel demonstration. Original project code has no open-source license; third-party dependencies retain their own terms.

**Evidence scope:** the local validation tables below preserve results from release preparation before hosting. They are historical evidence, not certification of the latest revision, current deployment, remote CI, or analytics dashboard. Verify those separately after changes.

## Reviewed application boundary

This snapshot contains application routes, components, typed rules, tests, source-checking tools, bounded public-source artifacts, synthetic fixtures, locked dependencies, non-secret configuration, and documentation. Data under `src/generated/change-radar/` is reviewed application input with recorded dates, not compiled output.

The original private history, hosting link, credentials, personal records, setup prompts, private notes, archived prototype, dependency folders, build output, logs, screenshots, and test traces were excluded from the reviewed source snapshot. It began as a separate Git repository on `main` without remotes, using `ONE Release Preparation <release@example.invalid>` as its initial packaging identity. Those preparation details describe the original snapshot, not the repository's current GitHub or Vercel connection. Installation, build, and validation outputs remain excluded from source control.

Visitors receive the application, browser code, and synthetic data without access to administrative accounts. Source is available in the public portfolio repository. Decisions stay in browser memory; explicit fictional exports save a file to the visitor's device. No browser route invokes source-checking scripts. See [security boundaries](SECURITY.md).

## Vercel build settings

These settings describe the application configuration; deployment logs and project settings establish the values used by an individual deployment.

| Setting | Value for this application |
| --- | --- |
| Framework preset | Next.js; installed version 16.3.4 using App Router |
| Root directory | Repository root, `.` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Framework-managed Next.js output; local build directory is `.next`. Leave the output-directory override unset |
| Node.js | `24.x`, matching `package.json` and the lockfile root; local checks and GitHub workflow use 24.18.0 |
| Required application environment values | None |
| Optional values | The committed example defaults both switches to `false`. This production demo opts in with `ONE_ALLOW_ANALYTICS=true`; indexing remains controlled separately by `ONE_ALLOW_INDEXING` |
| Hosting-provided values | `NODE_ENV`, `VERCEL`, `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL`, and `VERCEL_URL`; use the new host's system variables, not values copied from the original project |
| Routing | `/` and `/briefing` open the briefing; `/lab?tour=1` opens the journey; `/about`, `/notices`, `/robots.txt`, and `/opengraph-image` use native Next.js routes. Unknown paths return 404; no custom rewrites or base path |
| Additional configuration | No `vercel.json` is needed for these Next.js defaults |

The Next.js preset manages build output. [Vercel build configuration](https://vercel.com/docs/deployments/configure-a-build) documents these settings. Vercel supports Node.js 24.x and manages minor/patch updates; confirm the actual hosted patch in the deployment build log. [Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

Analytics require `ONE_ALLOW_ANALYTICS=true`, `NODE_ENV=production`, `VERCEL=1`, and `VERCEL_ENV=production` when building the deployment. The root layout includes Vercel Analytics only when all four conditions hold. Its client filter allows pageviews only and removes query strings and fragments from tracked page URLs; custom events are disabled. Automated pageviews and visits with referrers containing queries, fragments, or credentials are suppressed, although the script can still load. Local and preview builds remain off. Enable Web Analytics in the Vercel project and redeploy after changing the production environment setting. Hosting-provider request logs are separate. A successful build does not prove analytics data has appeared in the dashboard.

Confirm that Vercel's system environment variables are exposed to the build so metadata uses the actual production hostname. Local metadata falls back to localhost. [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables)

## Historical independent local validation

These preparation checks used this folder's own installation, Windows, Node.js 24.18.0, and npm 11.16.0. Dependencies and build output were not borrowed from the original project. GitHub Actions selected Node.js 24.18.0; its first remote Linux run had not yet been verified when this evidence was recorded.

| Preparation revision check | Recorded result |
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

The install reported the ESLint end-of-life warning below and a local npm policy warning for `unrs-resolver`'s optional postinstall. No script permission was broadened. Warnings are recorded separately from check failures; no completed preparation check above failed.

### Earlier snapshot evidence

These earlier results establish a baseline that predates the Node.js declaration and notices changes checked above:

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

DemoOps is a public portfolio repository. Original project code has no open-source license, and public availability does not grant one. The Apache 2.0 decision for the separate ONE-job-loop project does not apply to DemoOps.

Third-party terms remain independent and preserved in [third-party notices](../THIRD_PARTY_NOTICES.md) and `licenses/`. The footer links to a static `GET /notices` response, making runtime dependency notices available directly to visitors. During preparation, its locally verified 279,797-byte response retained all six runtime notice inputs, including the bundled Next.js notices and their upstream attribution. Recheck hosted delivery after deployments.

Upstream notice bytes retain their original line endings and whitespace through `.gitattributes`; they are not reformatted for a whitespace check. This review is not a comprehensive license-compatibility certification.

## Deployment verification and remaining limitations

The preparation review found no unresolved local deployment blocker. Its historical results cannot establish the status of a later deployment. For each release:

- Confirm the intended repository, Vercel project, production branch, and deployed revision.
- Check build settings, production environment values, applicable deployment protection, and public visitor access.
- Verify the live URL, routes including `/notices`, journey/reset, and visitor network behavior.
- Confirm the analytics script loads, a normal manual visit sends a pageview with no query string or fragment in its tracked URL, and production visits appear in the Vercel dashboard. Automated checks suppress events and cannot prove dashboard ingestion. Dashboard verification is separate from deployment success.
- Check the latest remote CI result. The included workflow only validates; it saves no checkout credentials and has no remote-write or deployment job. Local Windows success cannot certify remote execution.

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
