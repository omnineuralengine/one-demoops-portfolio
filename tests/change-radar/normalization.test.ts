import { describe, expect, it } from "vitest";

import {
  compareNormalizedDocuments,
  hashNormalizedContent,
  isPathAllowedByRobots,
  isLikelyAccessControlInterstitial,
  normalizeFeed,
  normalizeHtml,
  normalizeMarkdown,
  parseRobotsTxt,
} from "../../scripts/change-radar-core.mjs";

describe("Change Radar normalization", () => {
  it("removes common navigation, footer, and cookie noise without losing content", () => {
    const first = normalizeHtml(`
      <nav>Docs Products Sign in</nav>
      <main>
        <h1>Release notes</h1>
        <p>Added SCIM sync diagnostics.</p>
      </main>
      <footer>Privacy Terms</footer>
    `);
    const second = normalizeHtml(`
      <main class="content">
        <h1><span>Release notes</span></h1>
        <div>Added   SCIM sync diagnostics.</div>
      </main>
      <div class="cookie-consent-banner">Accept all cookies</div>
    `);

    expect(first).toBe("# Release notes\n\nAdded SCIM sync diagnostics.");
    expect(second).toBe(first);
    expect(hashNormalizedContent(first)).toBe(hashNormalizedContent(second));
    expect(hashNormalizedContent(first)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normalizes Markdown presentation while retaining meaningful headings", () => {
    const markdown = normalizeMarkdown(`
# 1.2.3

[API guide](https://example.test/tracking?campaign=one)

* Added bounded retries.
* Added MCP diagnostics.
    `);

    expect(markdown).toContain("# 1.2.3");
    expect(markdown).toContain("API guide");
    expect(markdown).not.toContain("campaign=one");
    expect(markdown).toContain("- Added MCP diagnostics.");
  });

  it("strips volatile feed build metadata", () => {
    const first = normalizeFeed(`
      <rss><channel><lastBuildDate>Tue, 01 Sep 2026 09:00:00 GMT</lastBuildDate>
      <title>Claude status</title><item><title>API available</title></item></channel></rss>
    `);
    const second = normalizeFeed(`
      <rss><channel><lastBuildDate>Tue, 01 Sep 2026 10:00:00 GMT</lastBuildDate>
      <title>Claude status</title><item><title>API available</title></item></channel></rss>
    `);

    expect(first).toBe(second);
  });

  it("recognizes access-control interstitials instead of treating them as documentation", () => {
    expect(
      isLikelyAccessControlInterstitial(
        "<html><title>Just a moment...</title><div id='cf-chl-widget'>Checking</div></html>",
      ),
    ).toBe(true);
    expect(
      isLikelyAccessControlInterstitial(
        "<html><title>Release notes</title><main>Documentation content</main></html>",
      ),
    ).toBe(false);
  });
});

describe("Change Radar comparison", () => {
  it("identifies changed headings and emits a short public-safe excerpt", () => {
    const previousText = normalizeMarkdown(`
# Release notes
## API
Rate limits are unchanged.
## Admin
SSO settings are available.
    `);
    const currentText = normalizeMarkdown(`
# Release notes
## API
Rate limits now use a documented retry window.
## Admin
SSO settings are available.
## MCP
Connector diagnostics are available.
    `);

    const comparison = compareNormalizedDocuments({ previousText, currentText });
    const excerpt = comparison.excerpt ?? "";

    expect(comparison.changedHeadings).toEqual(["API", "MCP"]);
    expect(excerpt).toContain("retry window");
    expect(excerpt.split(/\s+/)).toHaveLength(
      Math.min(excerpt.split(/\s+/).length, 24),
    );
    expect(excerpt.split(/\s+/).length).toBeLessThanOrEqual(24);
    expect(comparison.headingDigests.every(({ hash }) => /^[a-f0-9]{64}$/.test(hash))).toBe(true);
  });

  it("can compare against persisted heading digests when no cached body exists", () => {
    const previousText = normalizeMarkdown("# API\nOld behavior.\n# Admin\nUnchanged.");
    const currentText = normalizeMarkdown("# API\nNew behavior.\n# Admin\nUnchanged.");
    const firstComparison = compareNormalizedDocuments({
      previousText: "# Baseline\nContent.",
      currentText: previousText,
    });

    const comparison = compareNormalizedDocuments({
      previousText: null,
      currentText,
      previousHeadingDigests: firstComparison.headingDigests,
    });

    expect(comparison.changedHeadings).toEqual(["API"]);
    expect(comparison.excerpt).toBeTruthy();
  });
});

describe("robots.txt governance", () => {
  it("uses the most specific matching rule and lets Allow win equal-length ties", () => {
    const rules = parseRobotsTxt(`
      User-agent: *
      Disallow: /docs/private/
      Allow: /docs/private/public$

      User-agent: one-demoops-change-radar
      Disallow: /admin
      Allow: /admin/release-notes
    `);

    expect(isPathAllowedByRobots("/admin", rules)).toBe(false);
    expect(isPathAllowedByRobots("/admin/release-notes", rules)).toBe(true);
    expect(isPathAllowedByRobots("/docs/private/secret", rules)).toBe(true);
  });
});
