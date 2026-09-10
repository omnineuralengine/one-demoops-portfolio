import type { Metadata } from "next";
import { Briefing } from "@/components/briefing/Briefing";

export const metadata: Metadata = {
  title: "Interview Briefing",
  description:
    "A 90-second introduction to an independent, synthetic DemoOps control plane built with ONE.",
};

export default function BriefingPage() {
  return <Briefing />;
}
