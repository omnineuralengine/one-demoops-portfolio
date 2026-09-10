import { afterEach, describe, expect, it, vi } from "vitest";
import { filterVisitorPageview } from "../../lib/visitor-analytics";

afterEach(() => vi.unstubAllGlobals());

describe("visitor analytics privacy", () => {
  it("removes all query parameters, fragments and credentials without changing the route", () => {
    const event = {
      type: "pageview" as const,
      url: "https://user:password@demo.example/lab?tour=1&email=private%40example.com#export-secret",
    };
    expect(filterVisitorPageview(event)).toEqual({ type: "pageview", url: "https://demo.example/lab" });
    expect(event.url).toContain("export-secret");
  });

  it("drops custom events, malformed URLs and non-web URLs", () => {
    expect(filterVisitorPageview({ type: "event", url: "https://demo.example/lab" })).toBeNull();
    for (const url of ["invalid", "data:text/plain,private", "file:///private/export.json"]) {
      expect(filterVisitorPageview({ type: "pageview", url })).toBeNull();
    }
  });

  it("drops automated browser and server traffic", () => {
    const event = { type: "pageview" as const, url: "https://demo.example/briefing" };
    vi.stubGlobal("navigator", { webdriver: true });
    expect(filterVisitorPageview(event)).toBeNull();
    vi.stubGlobal("navigator", undefined);
    expect(filterVisitorPageview(event)).toBeNull();
  });

  it("drops visits when the SDK's separate referrer field could expose URL data", () => {
    const event = { type: "pageview" as const, url: "https://demo.example/briefing" };
    for (const referrer of ["https://other.example/?secret=value", "https://other.example/#private", "https://user:password@other.example/"]) {
      vi.stubGlobal("document", { referrer });
      expect(filterVisitorPageview(event)).toBeNull();
    }
    vi.stubGlobal("document", { referrer: "https://other.example/portfolio" });
    expect(filterVisitorPageview(event)).toEqual(event);
  });
});
