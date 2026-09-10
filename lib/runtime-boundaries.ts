export interface HostedAnalyticsEnvironment {
  readonly NODE_ENV?: string;
  readonly VERCEL?: string;
  readonly VERCEL_ENV?: string;
  readonly ONE_ALLOW_ANALYTICS?: string;
}

/** Telemetry requires a deliberate opt-in in the new host's production environment. */
export function shouldEnableHostedAnalytics(environment: HostedAnalyticsEnvironment): boolean {
  return environment.ONE_ALLOW_ANALYTICS === "true"
    && environment.NODE_ENV === "production"
    && environment.VERCEL === "1"
    && environment.VERCEL_ENV === "production";
}
