import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const demo = JSON.parse(readFileSync("demo-credentials.json", "utf8"));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 1000));
});
page.on("response", (r) => {
  if (r.url().includes("/api/"))
    console.log("API", r.status(), new URL(r.url()).pathname);
});
await page.goto("http://localhost:3000/login");
await page.getByLabel("Email address").fill(demo.identities.recruiter.email);
await page
  .getByLabel("Password", { exact: true })
  .fill(demo.identities.recruiter.password);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
try {
  await page
    .getByRole("heading", { name: /Good (morning|afternoon|evening)/ })
    .waitFor({ timeout: 20000 });
} catch {
  console.log("No workspace heading.");
}
console.log("URL", page.url());
console.log("Body", await page.locator("body").innerText());
console.log(
  "Cookie flags",
  (await page.context().cookies()).map((c) => ({
    name: c.name,
    domain: c.domain,
    secure: c.secure,
    sameSite: c.sameSite,
  })),
);
await page.screenshot({
  path: "test-results/debug-browser.png",
  fullPage: true,
});
await browser.close();
