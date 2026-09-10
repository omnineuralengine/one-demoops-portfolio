import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-static";

const noticeFiles = [
  ["Next.js", "next/license.md"],
  ["React", "react/LICENSE"],
  ["React DOM", "react-dom/LICENSE"],
  ["Lucide and Feather-derived icons", "lucide-react/LICENSE"],
  ["Vercel Analytics (optional, disabled by default)", "vercel--analytics/LICENSE"],
  ["Third-party components bundled with Next.js", "next/BUNDLED_NOTICES.txt"],
] as const;

export async function GET() {
  const sections = await Promise.all(noticeFiles.map(async ([title, file]) => {
    const notice = await readFile(join(process.cwd(), "licenses", file), "utf8");
    return `===== ${title} =====\n\n${notice}`;
  }));

  const introduction = [
    "ONE DemoOps Control Plane — third-party notices",
    "",
    "These are the preserved notices for third-party runtime dependencies, including components bundled with Next.js.",
    "They apply only to their respective third-party components. This document does not grant an open-source license to ONE DemoOps Control Plane.",
    "The bundled notices include components that may not appear in the browser build. Original notice text is retained below.",
  ].join("\n");

  return new Response(`${introduction}\n\n${sections.join("\n\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
