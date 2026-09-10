export { hashNormalizedContent, buildHeadingDigests } from "../change-radar-core.mjs";
import { createHash } from "node:crypto";
export function stableEventId(parts: readonly string[]): string { return `change:${createHash("sha256").update(parts.join("\u001f"), "utf8").digest("hex").slice(0, 32)}`; }
