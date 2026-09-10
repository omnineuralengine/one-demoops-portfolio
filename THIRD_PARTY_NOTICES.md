# Third-party notices

This file records attribution for the exact direct dependencies in `package.json` and `package-lock.json`. The original application has no project license file; these third-party terms do not choose a license for ONE DemoOps Control Plane.

The hosted demo exposes the complete preserved runtime notices at `/notices`, linked from its footer. This keeps those notices available when the source repository is private. No open-source license for DemoOps is granted by that page.

## Dependency notices

The following license and notice files were copied byte-for-byte from the installed packages at these pinned versions. Lucide includes both its ISC license and the MIT notice for icons derived from Feather. Playwright and TypeScript include their shipped third-party notices. `eslint-config-next` declares MIT in its package metadata but ships no separate license text; the Next.js repository license is linked explicitly.

| Package | Version | Use | Declared terms | Preserved upstream text |
| --- | --- | --- | --- | --- |
| @vercel/analytics | 2.0.1 | Runtime | MIT | [LICENSE](licenses/vercel--analytics/LICENSE) |
| lucide-react | 1.39.0 | Runtime | ISC; Feather-derived icons MIT | [LICENSE](licenses/lucide-react/LICENSE) |
| next | 16.3.4 | Runtime | MIT | [license.md](licenses/next/license.md) |
| react | 19.2.8 | Runtime | MIT | [LICENSE](licenses/react/LICENSE) |
| react-dom | 19.2.8 | Runtime | MIT | [LICENSE](licenses/react-dom/LICENSE) |
| @playwright/test | 1.62.1 | Development | Apache-2.0 | [LICENSE](licenses/playwright--test/LICENSE), [NOTICE](licenses/playwright--test/NOTICE) |
| @testing-library/jest-dom | 7.0.1 | Development | MIT | [LICENSE](licenses/testing-library--jest-dom/LICENSE) |
| @testing-library/react | 16.3.3 | Development | MIT | [LICENSE](licenses/testing-library--react/LICENSE) |
| @testing-library/user-event | 14.6.7 | Development | MIT | [LICENSE](licenses/testing-library--user-event/LICENSE) |
| @types/node | 26.4.1 | Development | MIT | [LICENSE](licenses/types--node/LICENSE) |
| @types/react | 19.2.18 | Development | MIT | [LICENSE](licenses/types--react/LICENSE) |
| @types/react-dom | 19.2.5 | Development | MIT | [LICENSE](licenses/types--react-dom/LICENSE) |
| eslint | 9.39.5 | Development | MIT | [LICENSE](licenses/eslint/LICENSE) |
| eslint-config-next | 16.3.4 | Development | MIT | No license text shipped in package; same Next.js repository, see [Next.js license](licenses/next/license.md). |
| jsdom | 30.0.1 | Development | MIT | [LICENSE.txt](licenses/jsdom/LICENSE.txt) |
| typescript | 6.0.3 | Development | Apache-2.0 | [LICENSE.txt](licenses/typescript/LICENSE.txt), [ThirdPartyNoticeText.txt](licenses/typescript/ThirdPartyNoticeText.txt) |
| vitest | 4.1.11 | Development | MIT | [LICENSE.md](licenses/vitest/LICENSE.md) |

Next.js also embeds third-party code inside its own distribution. [Bundled Next.js notices](licenses/next/BUNDLED_NOTICES.txt) retain all 130 license/notice files found in its installed `dist/` tree, with package-relative boundaries. This is a notice snapshot, not an assertion that every embedded component appears in the browser bundle.

Dependency folders and built JavaScript are not part of this source release. `npm ci` retrieves the locked packages with their upstream notices. The lockfile records transitive packages; this direct-dependency index is not a complete transitive-license or legal compatibility audit. Preserve the package notices when redistributing dependencies or a production build, and refresh this snapshot when dependencies change.

## Public references and product names

The demonstration uses public Anthropic/Claude documentation and release notes, plus a linked Salesforce announcement, as attributed reference material. Source URLs, source titles, recorded timestamps, and bounded excerpts are retained with the evidence in `features/causal-loop/public-reference.ts`, `data/change-radar/registry.ts`, and `src/generated/change-radar/`. Rehearsal text, operational impacts, teams, organizations, and outcomes are authored synthetic examples.

Anthropic, Claude, Salesforce, Vercel, React, Next.js, Lucide, and other product names belong to their respective owners. References and dependency use do not imply sponsorship, endorsement, or affiliation. The application does not include third-party brand logos, stock photographs, or externally hosted fonts.

Independent, synthetic demonstration built from publicly available information. Not affiliated with Anthropic and not representative of Anthropic’s internal systems or architecture.
