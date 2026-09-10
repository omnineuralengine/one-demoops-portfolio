// A bounded historical reference, reviewed manually. No browser fetch or live-diff claim.
export const PUBLIC_CHANGE_REFERENCE = {
  title: "Claude Opus 3 retired from the API",
  sourceTitle: "Claude Platform release notes",
  url: "https://platform.claude.com/docs/en/release-notes/overview#january-5-2026",
  publishedOn: "2026-01-05",
  reviewedAt: "2026-09-10T14:48:47Z",
  excerpt: "We've retired the Claude Opus 3 model (`claude-3-opus-20240229`).",
  summary: "The release note announces that requests to the retired model return errors. A previously prepared demo may need a different model and a new access check.",
  boundary: "Recorded public reference, manually reviewed on September 10, 2026. This is a historical announcement, not a fresh alert or a captured before/after page diff. The entitlement wording and outcomes below are authored rehearsal fixtures.",
} as const;
