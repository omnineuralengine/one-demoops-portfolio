import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

test("public footer opens complete runtime notices without access to the private repository", async ({ page }) => {
  await page.goto("/briefing");
  const link = page.getByRole("contentinfo").getByRole("link", { name: "Third-party notices", exact: true });
  await expect(link).toHaveAttribute("href", "/notices");

  for (let count = 0; count < 45; count += 1) {
    if (await link.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(link).toBeFocused();

  const [response] = await Promise.all([
    page.waitForResponse((result) => new URL(result.url()).pathname === "/notices"
      && result.request().resourceType() === "document"),
    page.keyboard.press("Enter"),
  ]);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/plain");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(page).toHaveURL(/\/notices$/);

  const body = await response.text();
  expect(body).toContain("does not grant an open-source license to ONE DemoOps Control Plane");
  const requiredFiles = [
    "next/license.md",
    "react/LICENSE",
    "react-dom/LICENSE",
    "lucide-react/LICENSE",
    "vercel--analytics/LICENSE",
    "next/BUNDLED_NOTICES.txt",
  ];
  for (const file of requiredFiles) {
    const original = await readFile(join(process.cwd(), "licenses", file), "utf8");
    expect(body.includes(original), `complete preserved notice: ${file}`).toBe(true);
  }
});
