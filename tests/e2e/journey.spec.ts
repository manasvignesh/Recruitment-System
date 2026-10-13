import { test, expect, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
const password = "Qa-Morrow-Only-2026!";
function resume() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream =
    "BT /F1 12 Tf 50 740 Td (QA Candidate - TypeScript and React experience) Tj ET";
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
async function request(
  ctx: BrowserContext,
  path: string,
  org?: string,
  body?: unknown,
  expected = 200,
) {
  const r = body
    ? await ctx.request.post(path, {
        headers: {
          ...(org ? { "x-organization-id": org } : {}),
          origin: "http://localhost:3000",
        },
        data: body,
      })
    : await ctx.request.get(path, {
        headers: org ? { "x-organization-id": org } : {},
      });
  const data = await r.json();
  expect(r.status(), data.error).toBe(expected);
  return data;
}
async function register(ctx: BrowserContext, name: string, email: string) {
  const send = () =>
    ctx.request.post("/api/auth/sign-up/email", {
      headers: { origin: "http://localhost:3000" },
      data: { name, email, password },
    });
  let r = await send();
  if (r.status() === 429) {
    await new Promise((resolve) => setTimeout(resolve, 11000));
    r = await send();
  }
  const d = await r.json();
  expect(r.status(), d.message).toBe(200);
  return d;
}
test("Complete hiring journey persists; roles, conflicts, private feedback, and offers are enforced", async ({
  browser,
}) => {
  const id = randomUUID().slice(0, 8);
  const contexts: BrowserContext[] = [];
  async function actor(name: string) {
    const c = await browser.newContext({ baseURL: "http://localhost:3000" });
    contexts.push(c);
    const email = `qa-${name.toLowerCase()}-${id}@example.invalid`;
    const u = await register(c, name + " QA", email);
    return { c, email, user: u.user };
  }
  const admin = await actor("Admin"),
    recruiter = await actor("Recruiter"),
    manager = await actor("Manager"),
    interviewer = await actor("Interviewer"),
    candidate = await actor("Candidate");
  const org = await request(
    admin.c,
    "/api/workspace/organizations",
    undefined,
    {
      name: "QA Isolated " + id,
      slug: "qa-" + id,
      description:
        "An isolated automated test organization. All records are fictional.",
    },
  );
  for (const [person, role] of [
    [recruiter, "recruiter"],
    [manager, "manager"],
    [interviewer, "interviewer"],
  ] as const) {
    const invite = await request(
      admin.c,
      "/api/workspace/settings/invite",
      org.id,
      { email: person.email, role },
    );
    const token = new URL(invite.url).searchParams.get("token");
    await request(person.c, "/api/workspace/organizations/join", undefined, {
      token,
    });
  }
  const department = await request(
    admin.c,
    "/api/workspace/settings/department",
    org.id,
    { name: "Engineering" },
  );
  const recruiterPage = await recruiter.c.newPage();
  await recruiterPage.goto("/workspace/jobs?org=" + org.id);
  await recruiterPage
    .getByRole("button", { name: "Create position", exact: true })
    .first()
    .click();
  const dialog = recruiterPage.getByRole("dialog");
  await dialog.getByLabel("Position title").fill("Software Engineer QA");
  await dialog
    .getByLabel("Department", { exact: true })
    .selectOption(department.id);
  await dialog.getByLabel("Hiring manager").selectOption(manager.user.id);
  await dialog.getByLabel("Location", { exact: true }).fill("Remote");
  await dialog.getByLabel("Work arrangement").selectOption("Remote");
  await dialog
    .getByLabel("About the role")
    .fill(
      "Build reliable recruitment workflows with TypeScript, React, and PostgreSQL. Work closely with the product team and own meaningful improvements.",
    );
  await dialog
    .getByLabel("Requirements and preferred qualifications")
    .fill("Experience building secure, accessible web applications.");
  await dialog.getByLabel("Skills", { exact: true }).fill("TypeScript, React");
  await dialog
    .getByLabel("Application questions")
    .fill("Describe a project you delivered.");
  await dialog.getByRole("button", { name: "Create requisition" }).click();
  await expect(dialog).not.toBeVisible();
  let job = (await request(recruiter.c, "/api/workspace/jobs", org.id))[0];
  expect(job.status).toBe("draft");
  await request(
    recruiter.c,
    `/api/workspace/jobs/${job.id}/status`,
    org.id,
    { status: "published", version: job.version },
    422,
  );
  await request(recruiter.c, `/api/workspace/jobs/${job.id}/status`, org.id, {
    status: "pending",
    version: job.version,
  });
  job = await request(manager.c, "/api/workspace/jobs/" + job.id, org.id);
  await request(
    recruiter.c,
    `/api/workspace/jobs/${job.id}/status`,
    org.id,
    { status: "approved", version: job.version },
    403,
  );
  await request(manager.c, `/api/workspace/jobs/${job.id}/status`, org.id, {
    status: "approved",
    version: job.version,
  });
  job = await request(recruiter.c, "/api/workspace/jobs/" + job.id, org.id);
  await request(recruiter.c, `/api/workspace/jobs/${job.id}/status`, org.id, {
    status: "published",
    version: job.version,
  });
  const candidatePage = await candidate.c.newPage();
  await candidatePage.goto(`/careers/${org.slug}/${job.id}`);
  await expect(
    candidatePage.getByRole("heading", {
      name: "Software Engineer QA",
      exact: true,
    }),
  ).toBeVisible();
  await candidatePage
    .getByRole("button", { name: "Apply for this role" })
    .click();
  const applicationForm = candidatePage.getByRole("dialog");
  await applicationForm.getByLabel("Full name").fill("Candidate QA");
  await applicationForm
    .getByLabel("A little about your experience")
    .fill(
      "Built accessible TypeScript workflows with a cross-functional team.",
    );
  await applicationForm
    .getByLabel("Skills", { exact: true })
    .fill("TypeScript, React");
  await applicationForm
    .getByLabel("Describe a project you delivered.")
    .fill(
      "Created an accessible applicant tracking workflow and verified tenant isolation.",
    );
  await applicationForm.getByLabel("Resume", { exact: true }).setInputFiles({
    name: "qa-resume.pdf",
    mimeType: "application/pdf",
    buffer: resume(),
  });
  await applicationForm.getByRole("checkbox").first().check();
  await applicationForm.getByRole("checkbox").last().check();
  await applicationForm
    .getByRole("button", { name: "Submit application" })
    .click();
  await expect(applicationForm).not.toBeVisible();
  await expect(
    candidatePage.getByText("Application received", { exact: true }),
  ).toBeVisible();
  let application = (
    await request(recruiter.c, "/api/workspace/applications", org.id)
  ).items[0];
  const appId = application.id;
  const candidateDetail = await request(
    recruiter.c,
    "/api/workspace/applications/" + appId,
    org.id,
  );
  expect(candidateDetail.documents[0].parsing_status).toBe("parsed");
  await request(
    recruiter.c,
    `/api/workspace/applications/${appId}/stage`,
    org.id,
    { stage: "Offer", version: application.version },
    422,
  );
  await recruiterPage.goto("/workspace/candidates?org=" + org.id);
  await recruiterPage.getByRole("button", { name: /Candidate QA/ }).click();
  const drawer = recruiterPage.getByRole("dialog");
  await drawer.getByRole("button", { name: "Move to Screening" }).click();
  await expect(
    drawer.getByRole("button", { name: "Move to Assessment" }),
  ).toBeVisible();
  await recruiterPage.reload();
  await recruiterPage.getByRole("button", { name: /Candidate QA/ }).click();
  await expect(
    recruiterPage
      .getByRole("dialog")
      .getByRole("button", { name: "Move to Assessment" }),
  ).toBeVisible();
  await request(
    recruiter.c,
    `/api/workspace/applications/${appId}/stage`,
    org.id,
    { stage: "Assessment", version: application.version },
    409,
  );
  const start = new Date(Date.now() + 2 * 86400000).toISOString();
  const interview = await request(
    recruiter.c,
    "/api/workspace/interviews",
    org.id,
    {
      application_id: appId,
      interviewer_id: interviewer.user.id,
      title: "Technical conversation QA",
      type: "Video",
      starts_at: start,
      duration: 45,
      timezone: "Asia/Kolkata",
      location: "https://example.invalid/meeting",
      instructions: "Bring one project to discuss.",
    },
  );
  await request(
    recruiter.c,
    "/api/workspace/interviews",
    org.id,
    {
      application_id: appId,
      interviewer_id: interviewer.user.id,
      title: "Conflict QA",
      type: "Video",
      starts_at: start,
      duration: 45,
      timezone: "Asia/Kolkata",
      location: "",
      instructions: "",
    },
    409,
  );
  const portal = await request(candidate.c, "/api/public/portal");
  expect(portal.interviews[0].title).toBe("Technical conversation QA");
  expect(portal.notes).toBeUndefined();
  expect(portal.scorecards).toBeUndefined();
  await request(
    interviewer.c,
    `/api/workspace/interviews/${interview.id}/scorecard`,
    org.id,
    {
      ratings: {
        "Role expertise": 4,
        "Problem solving": 4,
        Communication: 4,
        Collaboration: 4,
      },
      body: "Specific project evidence demonstrates clear problem solving and thoughtful collaboration.",
      recommendation: "Yes",
      submitted: true,
    },
  );
  await request(
    interviewer.c,
    `/api/workspace/interviews/${interview.id}/scorecard`,
    org.id,
    {
      ratings: {
        "Role expertise": 5,
        "Problem solving": 5,
        Communication: 5,
        Collaboration: 5,
      },
      body: "Attempt to change locked feedback.",
      recommendation: "Yes",
      submitted: true,
    },
    409,
  );
  expect(
    (await request(manager.c, "/api/workspace/applications/" + appId, org.id))
      .scorecards,
  ).toHaveLength(1);
  for (const stage of ["Assessment", "Interview", "Final Review", "Offer"]) {
    if (stage === "Offer")
      await request(
        manager.c,
        "/api/workspace/applications/" + appId + "/decision",
        org.id,
        {
          outcome: "advance",
          evidence:
            "The scorecard contains specific project evidence supporting this hiring decision.",
        },
      );
    application = (
      await request(recruiter.c, "/api/workspace/applications/" + appId, org.id)
    ).application;
    await request(
      recruiter.c,
      `/api/workspace/applications/${appId}/stage`,
      org.id,
      { stage, version: application.version },
    );
  }
  let offer = await request(recruiter.c, "/api/workspace/offers", org.id, {
    application_id: appId,
    compensation: 120000,
    currency: "USD",
    start_date: "2027-01-15",
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    terms:
      "Full-time Software Engineer role. Remote employment with an annual salary of USD 120,000. Offer subject to final employment documentation.",
  });
  offer = await request(
    recruiter.c,
    "/api/workspace/offers/" + offer.id + "/edit",
    org.id,
    {
      compensation: 125000,
      currency: "USD",
      start_date: "2027-01-15",
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      terms:
        "Revised annual compensation of USD 125,000 for a full-time Software Engineer role. Final employment documentation will follow.",
      version: offer.version,
    },
  );
  await request(recruiter.c, "/api/workspace/offers/" + offer.id, org.id, {
    status: "pending",
    version: offer.version,
  });
  offer = (
    await request(manager.c, "/api/workspace/applications/" + appId, org.id)
  ).offers[0];
  await request(manager.c, "/api/workspace/offers/" + offer.id, org.id, {
    status: "approved",
    version: offer.version,
  });
  offer = (
    await request(recruiter.c, "/api/workspace/applications/" + appId, org.id)
  ).offers[0];
  await request(recruiter.c, "/api/workspace/offers/" + offer.id, org.id, {
    status: "available",
    version: offer.version,
  });
  await candidatePage.goto("/portal");
  await candidatePage.getByRole("button", { name: "Accept offer" }).click();
  await expect(
    candidatePage.getByText("accepted", { exact: true }),
  ).toBeVisible();
  await candidatePage.reload();
  await expect(
    candidatePage.getByText("accepted", { exact: true }),
  ).toBeVisible();
  await request(
    recruiter.c,
    "/api/workspace/offers/" + offer.id + "/hire",
    org.id,
    {},
  );
  const final = (
    await request(recruiter.c, "/api/workspace/applications/" + appId, org.id)
  ).application;
  expect(final.status).toBe("hired");
  expect(final.stage).toBe("Hired");
  const versions = (
    await request(recruiter.c, "/api/workspace/applications/" + appId, org.id)
  ).offerVersions;
  expect(versions.length).toBe(6);
  expect(versions[0].snapshot.status).toBe("accepted");
  const offerFile = await candidate.c.request.get(
    "/api/self/offer/" + offer.id,
  );
  expect(offerFile.status()).toBe(200);
  expect(await offerFile.text()).toContain("Employment offer");
  job = (await request(recruiter.c, "/api/workspace/jobs", org.id))[0];
  expect(job.status).toBe("closed");
  expect(job.hired_count).toBe(1);
  const metrics = await request(
    recruiter.c,
    "/api/workspace/analytics",
    org.id,
  );
  expect(metrics.metrics.hires).toBe(1);
  expect(metrics.offers.accepted).toBe(1);
  const audit = await request(admin.c, "/api/workspace/audit", org.id);
  expect(audit.some((e: any) => e.action === "Hire completed")).toBe(true);
  expect(audit.some((e: any) => e.action === "Offer accepted")).toBe(true);
  const outsider = await actor("Outsider");
  const other = await request(
    outsider.c,
    "/api/workspace/organizations",
    undefined,
    { name: "QA Other " + id, slug: "qa-other-" + id },
  );
  await request(
    outsider.c,
    "/api/workspace/applications/" + appId,
    org.id,
    undefined,
    403,
  );
  await request(
    outsider.c,
    "/api/workspace/applications/" + appId,
    other.id,
    undefined,
    404,
  );
  await request(
    candidate.c,
    "/api/workspace/applications/" + appId,
    org.id,
    undefined,
    403,
  );
  await request(
    interviewer.c,
    "/api/workspace/settings",
    org.id,
    undefined,
    403,
  );
  await request(
    interviewer.c,
    "/api/workspace/jobs",
    org.id,
    { title: "Unauthorized" },
    403,
  );
  const file = await outsider.c.request.get(
    "/api/public/files/" + candidateDetail.documents[0].id,
  );
  expect(file.status()).toBe(404);
  await recruiterPage.goto("/workspace/analytics?org=" + org.id);
  await expect(
    recruiterPage.getByText("Hires completed", { exact: true }),
  ).toBeVisible();
  await recruiterPage.screenshot({
    path: "test-results/verified-analytics.png",
    fullPage: true,
  });
  for (const c of contexts) await c.close();
});
