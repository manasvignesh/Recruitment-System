import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("Demo workspace screens, command menu, dark theme, and mobile layout", async ({
  page,
}) => {
  const demo = JSON.parse(readFileSync("demo-credentials.json", "utf8"));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(demo.identities.recruiter.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(demo.identities.recruiter.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Jamie/,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/workbench-desktop.png",
    fullPage: true,
  });
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("heading", { name: "Command center" }),
  ).toBeVisible();
  await page.getByLabel("Search your workspace").fill("Maya");
  await expect(page.getByRole("button", { name: /Maya Chen/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Create position", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Position title")
    .fill("An unsaved position");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Keep your changes?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create a position" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(
    page.getByRole("button", { name: "Use light theme" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/workbench-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Use light theme" }).click();
  for (const [view, title] of [
    ["jobs", "Room for someone great."],
    ["candidates", "Your next great connection."],
    ["interviews", "Better conversations ahead."],
    ["talent", "Good people. Future possibilities."],
    ["analytics", "Progress, with perspective."],
    ["tasks", "Small steps. Real progress."],
    ["messages", "A good conversation."],
  ]) {
    await page.goto("/workspace/" + view + "?org=" + demo.orgId);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".error-box")).toHaveCount(0);
  }
  await page.goto("/workspace/candidates?org=" + demo.orgId);
  await page.getByLabel("Select Maya Chen").check();
  await page.getByLabel("Select Ethan Brooks").check();
  await page.getByRole("button", { name: "Compare 2", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Compare the evidence" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  await expect(
    page.locator(".board-heading").filter({ hasText: /^Applied/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/pipeline-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: /Maya Chen/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Maya Chen", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/candidate-desktop.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace?org=" + demo.orgId);
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Jamie/,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Jobs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Room for someone great." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/workspace-mobile.png",
    fullPage: true,
  });
  await page.goto("/careers/northstar-demo");
  await expect(page.getByRole("heading", { name: /Good work/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/careers-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
