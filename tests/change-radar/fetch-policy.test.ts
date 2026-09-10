import { describe, expect, it, vi } from "vitest";

import {
  fetchDocumentationSource,
  type FetchableDocumentationSource,
} from "../../scripts/change-radar-core.mjs";

const SOURCE: FetchableDocumentationSource = {
  id: "example-release-notes",
  url: "https://docs.example.test/releases",
  format: "MARKDOWN",
  allowedRedirectHosts: ["docs.example.test"],
  allowedPathPrefixes: ["/releases", "/release-notes", "/private/releases"],
};

describe("Change Radar fetch policy", () => {
  it("honors robots, conditional validators, and bounded same-host redirects", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "https://docs.example.test/robots.txt") {
        return new Response("User-agent: *\nAllow: /", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      if (url === SOURCE.url) {
        return new Response(null, {
          status: 302,
          headers: { location: "/release-notes" },
        });
      }
      if (url === "https://docs.example.test/release-notes") {
        return new Response("# Release notes\nA governed update.", {
          status: 200,
          headers: {
            "content-type": "text/markdown",
            etag: '"current"',
            "last-modified": "Wed, 02 Sep 2026 12:00:00 GMT",
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchDocumentationSource(
      SOURCE,
      {
        etag: '"previous"',
        lastModified: "Tue, 01 Sep 2026 12:00:00 GMT",
      },
      { fetchImpl, retries: 0, timeoutMs: 1_000 },
    );

    expect(result.notModified).toBe(false);
    expect(result.body).toContain("governed update");
    expect(result.metadata).toMatchObject({
      finalUrl: "https://docs.example.test/release-notes",
      redirectCount: 1,
      statusCode: 200,
      etag: '"current"',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    const initialRequest = fetchImpl.mock.calls.find(([input]) => String(input) === SOURCE.url);
    const headers = new Headers(initialRequest?.[1]?.headers);
    expect(headers.get("if-none-match")).toBe('"previous"');
    expect(headers.get("if-modified-since")).toBe("Tue, 01 Sep 2026 12:00:00 GMT");
    expect(headers.get("user-agent")).toContain("ONE-DemoOps-Change-Radar");
    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
    expect(initialRequest?.[1]?.redirect).toBe("manual");
  });

  it("does not request a source path disallowed by robots.txt", async () => {
    const blockedSource = {
      ...SOURCE,
      url: "https://docs.example.test/private/releases",
    };
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      expect(String(input)).toBe("https://docs.example.test/robots.txt");
      return new Response("User-agent: *\nDisallow: /private/", { status: 200 });
    });

    await expect(
      fetchDocumentationSource(blockedSource, null, {
        fetchImpl,
        retries: 0,
        timeoutMs: 1_000,
      }),
    ).rejects.toThrow("robots.txt disallows /private/releases");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("requires an explicit path allowlist", async () => {
    await expect(fetchDocumentationSource({ ...SOURCE, allowedPathPrefixes: [] }, null, {
      fetchImpl: vi.fn<typeof fetch>(),
      retries: 0,
    })).rejects.toThrow("path allowlist");
  });
});
