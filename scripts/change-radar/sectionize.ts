import { hashNormalizedContent } from "../change-radar-core.mjs";

export const MAX_COMPARISON_SECTIONS = 500;

export class SectionLimitError extends Error {
  constructor(limit = MAX_COMPARISON_SECTIONS) {
    super(`Document exceeded the ${limit}-section comparison limit.`);
    this.name = "SectionLimitError";
  }
}

export interface RadarSection { headingPath: string[]; occurrence: number; body: string; hash: string; order: number; }
export function sectionize(text: string): RadarSection[] {
  const stack: string[] = []; const occurrences = new Map<string, number>(); const sections: RadarSection[] = []; let current = { path: ["Document body"], body: [] as string[] };
  const flush = () => { const body = current.body.join("\n").trim(); if (!body && current.path[0] === "Document body" && sections.length === 0) return; if (sections.length >= MAX_COMPARISON_SECTIONS) throw new SectionLimitError(); const key = current.path.join("\u001f").toLowerCase(); const occurrence = (occurrences.get(key) ?? 0) + 1; occurrences.set(key, occurrence); sections.push({ headingPath: current.path, occurrence, body, hash: hashNormalizedContent(`${current.path.join("\n")}\n${occurrence}\n${body}`), order: sections.length }); };
  for (const line of text.split("\n")) { const match = /^(#{1,6})\s+(.+)$/.exec(line); if (!match) { current.body.push(line); continue; } flush(); const level = match[1].length; stack.length = level - 1; stack[level - 1] = match[2].replace(/\s+#+\s*$/, "").trim(); current = { path: stack.filter(Boolean), body: [] }; }
  flush(); return sections.length ? sections : [{ headingPath: ["Document body"], occurrence: 1, body: "", hash: hashNormalizedContent("Document body\n1\n"), order: 0 }];
}
