import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
test("Core pages satisfy automated WCAG 2.2 AA checks", async ({ page }) => {
  const demo = JSON.parse(readFileSync("demo-credentials.json", "utf8"));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(demo.identities.admin.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(demo.identities.admin.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Alex/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use dark theme" }).click();
  const darkResult = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    darkResult.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "Use light theme" }).click();
  for (const path of [
    "/workspace?org=" + demo.orgId,
    "/workspace/jobs?org=" + demo.orgId,
    "/workspace/settings?org=" + demo.orgId,
    "/careers/northstar-demo",
    "/portal",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});
