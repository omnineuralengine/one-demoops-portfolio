import type { Metadata } from "next";
import latestChangeRadar from "@/src/generated/change-radar/latest.json";
import generatedSourceHealth from "@/src/generated/change-radar/source-health.json";
import { createSyntheticState } from "@/data/synthetic/seed";
import { ControlPlaneApp } from "@/features/command-center/ControlPlaneApp";
import { parseLatestArtifact, parseSourceHealthArtifact } from "@/lib/change-radar/schema";

export const metadata: Metadata = {
  title: "Synthetic Control Plane",
  description:
    "Explore the independent ONE DemoOps synthetic command center, governed agents, explainable gateway, public Change Radar, missions, and debriefs.",
};

export default function LabPage() {
  const initialState = createSyntheticState();
  const liveEvents = parseLatestArtifact(latestChangeRadar).events;
  const sourceHealth = parseSourceHealthArtifact(generatedSourceHealth).sources;
  return <ControlPlaneApp initialState={initialState} liveEvents={liveEvents} sourceHealth={sourceHealth} />;
}
