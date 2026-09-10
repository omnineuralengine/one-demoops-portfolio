import { describe, expect, it } from "vitest";
import { CURATED_WATCHLIST, isAllowlistedUrl } from "../../features/change-radar/source-registry/watchlist";
import { classifyDeterministically, parsePublishedAt } from "../../scripts/change-radar/classify";
import { diffSections } from "../../scripts/change-radar/diff";
import { retainBoundedHistory } from "../../scripts/change-radar/emit";
import { extractMarkdownCandidates } from "../../scripts/change-radar/discover";

describe("Phase 2 public-source pipeline", () => {
  it("keeps a curated role-relevant watchlist with path allowlisting", () => {
    expect(CURATED_WATCHLIST.length).toBeGreaterThanOrEqual(20);
    expect(CURATED_WATCHLIST.length).toBeLessThanOrEqual(35);
    const source = CURATED_WATCHLIST[0];
    expect(isAllowlistedUrl(source, source.canonicalUrl)).toBe(true);
    expect(isAllowlistedUrl(source, "https://evil.example/llms.txt")).toBe(false);
    expect(isAllowlistedUrl(source, "https://platform.claude.com/account/delete")).toBe(false);
  });

  it("discovers canonical markdown pages but does not enable candidates", () => {
    expect(extractMarkdownCandidates("- [Admin](https://platform.claude.com/docs/en/admin.md)\n/docs/en/models.md", "https://platform.claude.com/llms.txt")).toEqual(["https://platform.claude.com/docs/en/admin.md", "https://platform.claude.com/docs/en/models.md"]);
  });

  it("detects added, modified, removed, and moved sections deterministically", () => {
    const changes = diffSections("# A\none\n# B\ntwo\n# Removed\nold", "# B\ntwo\n# A\nchanged\n# Added\nnew");
    expect(changes.map(({ type }) => type)).toEqual(expect.arrayContaining(["MOVED_SECTION", "MODIFIED_SECTION", "ADDED_SECTION", "REMOVED_SECTION"]));
  });

  it("classifies policy language as inference and distinguishes detected from published dates", () => {
    expect(classifyDeterministically("Required migration for a deprecated model ID")).toMatchObject({ impactLevel: "REVIEW_REQUIRED", inference: true });
    expect(parsePublishedAt("No publication date available")).toBeNull();
    expect(parsePublishedAt("Released August 26, 2026")).toBe("2026-08-26T00:00:00.000Z");
  });

  it("retains bounded compact history", () => {
    expect(retainBoundedHistory([1, 2, 3], [4, 5], 3)).toEqual([3, 4, 5]);
  });
});
