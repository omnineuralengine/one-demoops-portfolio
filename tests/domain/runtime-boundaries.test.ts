import { describe, expect, it } from "vitest";
import { shouldEnableHostedAnalytics } from "../../lib/runtime-boundaries";

describe("runtime boundaries", () => {
  it("keeps hosted analytics disabled in local production and development", () => {
    expect(shouldEnableHostedAnalytics({ NODE_ENV: "production" })).toBe(false);
    expect(shouldEnableHostedAnalytics({ NODE_ENV: "development", VERCEL: "1" })).toBe(false);
  });

  it("defaults to no telemetry even on a hosted production deployment", () => {
    expect(shouldEnableHostedAnalytics({ NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production" })).toBe(false);
  });

  it("requires explicit opt-in and the new host's production environment", () => {
    const optedIn = { NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production", ONE_ALLOW_ANALYTICS: "true" };
    expect(shouldEnableHostedAnalytics(optedIn)).toBe(true);
    expect(shouldEnableHostedAnalytics({ ...optedIn, ONE_ALLOW_ANALYTICS: "false" })).toBe(false);
    expect(shouldEnableHostedAnalytics({ ...optedIn, VERCEL_ENV: "preview" })).toBe(false);
    expect(shouldEnableHostedAnalytics({ ...optedIn, VERCEL: undefined })).toBe(false);
    expect(shouldEnableHostedAnalytics({ ...optedIn, NODE_ENV: "development" })).toBe(false);
  });
});
