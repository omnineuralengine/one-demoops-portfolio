# Release preparation and validation

Status: **NOT READY for public release.** The reviewed source snapshot is prepared locally. Publication and deployment have not been performed. The unsupported lint-toolchain dependency and unresolved project licensing decision below remain open.

## What is included

The application routes, shared components, feature modules, typed rules, tests, source-checking tools, bounded public-source artifacts, synthetic fixtures, locked dependency manifest, non-secret configuration, and public-facing documentation are included. Source metadata under `src/generated/change-radar/` is intentional reviewed input, not compiled output. Its dates and fixture boundaries are retained.

The original history, remote, hosting-project link, credentials, personal records, private setup/build prompts, internal release notes, archived prototype, dependencies, build output, logs, screenshots, and test traces are excluded. Third-party notices are preserved under `licenses/`; published upstream attribution names and addresses are retained as required notices, not copied personal records.

This repository starts on `main` with a fresh commit and no remotes. The packaging author is `ONE Release Preparation <release@example.invalid>`; it does not import the original commit identity or claim authorship of third-party code. The original project remains separate and unchanged. Generated validation files and independently installed dependencies were moved into a separate temporary validation workspace after testing. They are absent from this release folder and its commit.

## Release-specific changes

- The README explains the lab in roughly 300–400 words and uses a verified local address. There is no verified hosted demo URL.
- Browser analytics require an explicit opt-in and a new host’s production environment; they are off by default, including previews. No account or hosting-project identifier is shipped.
- Type checking first generates route types, so it works without copied build output. `next-env.d.ts` is generated locally and ignored.
- Browser tests launch this folder’s production build on port 3200 and refuse to reuse an existing server. Set `ONE_E2E_PORT` to another unused port if needed. This prevents accidental testing of the original project.
- A read-only validation workflow replaces the original private-repository publication workflow. It uses reviewed pinned actions, saves no checkout credentials, and performs no source synchronization, remote writes, artifact publication, or deployment.

## Independent validation

Validation runs from this folder with its own `npm ci` installation. Dependencies and `.next` are not copied or linked from the original. The test host uses Windows, Node.js 24.18.0, and npm 11.16.0. CI specifies the declared minimum Node.js 22.22.2, but remote Linux CI and that minimum runtime have not been executed here.

| Check | Evidence |
| --- | --- |
| `npm ci` | Installed 445 packages independently; audit reported zero known vulnerabilities |
| `npm run lint` | Passed with zero lint warnings |
| `npm run typecheck` | Route generation and TypeScript passed without original build output |
| `npm test` | 33 files, 240 tests passed in 61.72 seconds |
| `npm run radar:validate` | Included public-source artifacts are schema-valid |
| README development command | `npm run dev -- --hostname 127.0.0.1 --port 3201` started this copy; briefing returned 200 and opened the journey with no browser errors, overlays, or external HTTP requests |
| `npm run build` | Passed; all 8 static pages generated successfully |
| `npm run test:e2e` | 10 Chromium browser tests passed against this folder’s production server in 32.9 seconds |
| Documented production command | Started this copy on port 3201; `/briefing`, `/about`, and `/lab` returned 200 with zero browser errors or external HTTP requests |
| Default browser persistence | Zero cookies, local-storage entries, session-storage entries, or IndexedDB databases after visiting the three main routes |
| Final release and client-asset review | Reviewed 190 eligible source/documentation/notice files, 13 production static assets, and 6 production HTML files; no credential, private-account-link, or personal-path findings. A final `.gitattributes` file only preserves notice bytes during checkout |
| Third-party notices | 18 direct license/notice files and 130 bundled Next.js notices matched this copy’s installed dependencies |
| Original project preservation | All 184 original tracked/untracked source files retained identical SHA-256 hashes; no files added and Git status unchanged |

The unit tests cover authority, approval/verification separation, reset, synthetic generation, export filtering, source input handling, and workflow restrictions. The browser suite exercises the six-step journey, keyboard focus, 320px/390px reduced-motion layouts, pause/reconsider, reset/refresh, free exploration, the existing scenario flow, and explicit validated fictional exports. Browser checks watch for external HTTP requests and server mutations during the guided journey.

The staged application and documentation pass `git diff --cached --check` when unchanged upstream notices are excluded. Those notices intentionally retain their original trailing whitespace and line endings; `.gitattributes` prevents Git from converting their bytes. No notice text was reformatted to satisfy a whitespace check.

The install also reported that the local npm script policy did not approve `unrs-resolver`’s optional postinstall. No script approval or permission setting was broadened. Type checking, lint, and tests passed with that policy intact. No live source synchronization, account access, or provider call is needed for validation.

## Remaining blockers and limits

**Unsupported development tooling:** ESLint 9.39.5 is pinned by this snapshot. ESLint’s [official support policy](https://eslint.org/version-support/) states that version 9 reached end of life on August 6, 2026. Lint passes, and the package audit found no known vulnerability, but the tool no longer receives upstream maintenance.

The current `eslint-config-next@16.3.4` dependency graph cannot accept a supported ESLint 10 upgrade without further changes: `eslint-plugin-import@2.32.0`, `eslint-plugin-jsx-a11y@6.10.2`, and `eslint-plugin-react@7.37.5` declare support only through ESLint 9. Their installed files and current public package metadata were checked. No forced or legacy-peer-dependency install was used. Resolve this through supported upstream versions or a separately reviewed lint-configuration change. This is a development-tool blocker, not evidence of a runtime vulnerability.

**Project license decision:** the original project supplies no project license. None has been selected or added. The owner must decide the intended reuse permissions before presenting this as a reusable public release. Third-party terms remain independent; [preserved notices](../THIRD_PARTY_NOTICES.md) do not license this project. This is an unresolved release decision, not a claim that GitHub technically requires a license file.

**Unverified hosting:** there is no hosted demo to link or deployment to certify. Hosting environment values, protection settings, access logs, optional analytics behavior, and a public reporting contact require review when publication is separately authorized. Nothing in this repository connects to the original administrative accounts. [Security boundaries](SECURITY.md) explain the default network and data behavior.

Physical mobile devices, screen-reader speech, Firefox, Safari, and remote GitHub Actions execution remain unverified. The scope of the source/asset review and dependency audit is bounded; passing tests are not a comprehensive security, accessibility, or license-compatibility certification.

## Reproduce the checks

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

After building, `npm run start -- --hostname 127.0.0.1 --port 3201` starts a local production copy. Stop the development server on that port first. The browser tests use their own separate port and manage that server themselves.

## Before any future publication

Resolve the unsupported tooling and license decision. Review any newly generated source artifacts and retain fixture labels and third-party notices. Connect only a deliberately chosen new repository/hosting project, keep credentials out of source and public bundles, and review the default indexing and analytics switches. Establish an appropriate reporting contact. Finally, verify the actual hosted URL and visitor network behavior before adding a live-demo link to the README. These are future review steps, not actions performed by this release preparation.
