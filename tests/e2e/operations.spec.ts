import { test, expect, type BrowserContext } from "@playwright/test";
import JSZip from "jszip";
import { randomUUID } from "node:crypto";
async function call(
  c: BrowserContext,
  path: string,
  org?: string,
  body?: unknown,
  status = 200,
) {
  const r = body
    ? await c.request.post(path, {
        headers: {
          origin: "http://localhost:3000",
          ...(org ? { "x-organization-id": org } : {}),
        },
        data: body,
      })
    : await c.request.get(path, {
        headers: org ? { "x-organization-id": org } : {},
      });
  const d = await r.json();
  expect(r.status(), d.error).toBe(status);
  return d;
}
async function docx() {
  const z = new JSZip();
  z.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  z.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  z.file(
    "word/document.xml",
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>QA applicant: PostgreSQL, React, and TypeScript experience.</w:t></w:r></w:p></w:body></w:document>',
  );
  return z.generateAsync({ type: "nodebuffer" });
}
test("Secondary operations, DOCX, consent, drafts, templates, notifications, and privacy persist", async ({
  browser,
}) => {
  const suffix = randomUUID().slice(0, 8),
    password = "QA-Operations-2026!";
  const admin = await browser.newContext({ baseURL: "http://localhost:3000" }),
    candidate = await browser.newContext({ baseURL: "http://localhost:3000" });
  const user = await call(admin, "/api/auth/sign-up/email", undefined, {
    name: "Operations Admin",
    email: `qa-ops-admin-${suffix}@example.invalid`,
    password,
  });
  await call(candidate, "/api/auth/sign-up/email", undefined, {
    name: "Operations Candidate",
    email: `qa-ops-candidate-${suffix}@example.invalid`,
    password,
  });
  const org = await call(admin, "/api/workspace/organizations", undefined, {
    name: "QA Operations " + suffix,
    slug: "qa-ops-" + suffix,
  });
  const job = await call(admin, "/api/workspace/jobs", org.id, {
    title: "Operations Engineer QA",
    department_id: null,
    manager_id: user.user.id,
    location: "Remote",
    workplace: "Remote",
    employment: "Full-time",
    openings: 2,
    salary_min: null,
    salary_max: null,
    currency: "USD",
    description:
      "Build thoughtful recruiting operations and secure database-backed workflows. Work closely with the product team to improve reliability.",
    requirements: "TypeScript and PostgreSQL experience.",
    skills: ["PostgreSQL", "TypeScript"],
    questions: [],
    closing_date: null,
  });
  for (const next of ["pending", "approved", "published"]) {
    const current = await call(admin, "/api/workspace/jobs/" + job.id, org.id);
    await call(admin, "/api/workspace/jobs/" + job.id + "/status", org.id, {
      status: next,
      version: current.version,
    });
  }
  let published = await call(admin, "/api/workspace/jobs/" + job.id, org.id);
  await call(admin, "/api/workspace/jobs/" + job.id + "/status", org.id, {
    status: "approved",
    version: published.version,
  });
  expect(
    (await call(candidate, "/api/public/careers/" + org.slug)).jobs,
  ).toHaveLength(0);
  published = await call(admin, "/api/workspace/jobs/" + job.id, org.id);
  await call(admin, "/api/workspace/jobs/" + job.id + "/status", org.id, {
    status: "published",
    version: published.version,
  });
  const r = await candidate.request.post(
    "/api/public/careers/" + org.slug + "/" + job.id,
    {
      headers: { origin: "http://localhost:3000" },
      multipart: {
        name: "Operations Candidate",
        phone: "",
        experience: "Built a secure PostgreSQL service.",
        skills: "PostgreSQL, TypeScript",
        answers: "{}",
        consent: "true",
        talent_consent: "true",
        resume: {
          name: "resume.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: await docx(),
        },
      },
    },
  );
  const result = await r.json();
  expect(r.status(), result.error).toBe(200);
  const appId = result.id;
  let detail = await call(
    admin,
    "/api/workspace/applications/" + appId,
    org.id,
  );
  expect(detail.documents[0].parsing_status).toBe("parsed");
  const defaultStages = [
    "Applied",
    "Screening",
    "Assessment",
    "Interview",
    "Final Review",
    "Offer",
    "Hired",
  ];
  const customStages = [
    "Applied",
    "Portfolio Review",
    ...defaultStages.slice(1),
  ];
  await call(admin, "/api/workspace/settings/pipeline", org.id, {
    stages: customStages,
  });
  expect(
    (await call(admin, "/api/workspace/reference", org.id)).stages.map(
      (s: any) => s.name,
    ),
  ).toEqual(customStages);
  await call(admin, "/api/workspace/applications/" + appId + "/stage", org.id, {
    stage: "Portfolio Review",
    version: detail.application.version,
  });
  detail = await call(admin, "/api/workspace/applications/" + appId, org.id);
  await call(
    admin,
    "/api/workspace/applications/" + appId + "/status",
    org.id,
    {
      status: "hold",
      reason: "Waiting for the candidate portfolio.",
      version: detail.application.version,
    },
  );
  await call(
    admin,
    "/api/workspace/settings/pipeline",
    org.id,
    { stages: defaultStages },
    409,
  );
  detail = await call(admin, "/api/workspace/applications/" + appId, org.id);
  await call(
    admin,
    "/api/workspace/applications/" + appId + "/stage",
    org.id,
    {
      stage: "Applied",
      version: detail.application.version,
    },
    422,
  );
  await call(
    admin,
    "/api/workspace/applications/" + appId + "/status",
    org.id,
    {
      status: "active",
      reason: "Portfolio received; review can resume.",
      version: detail.application.version,
    },
  );
  detail = await call(admin, "/api/workspace/applications/" + appId, org.id);
  await call(admin, "/api/workspace/applications/" + appId + "/stage", org.id, {
    stage: "Applied",
    version: detail.application.version,
  });
  await call(admin, "/api/workspace/settings/pipeline", org.id, {
    stages: defaultStages,
  });
  detail = await call(admin, "/api/workspace/applications/" + appId, org.id);
  const document = detail.documents[0];
  const text = await call(
    admin,
    `/api/public/files/${document.id}?org=${org.id}&text=true`,
  );
  expect(text.text).toContain("PostgreSQL");
  await call(admin, "/api/workspace/documents/" + document.id, org.id, {
    text: "Manually corrected resume text, verified against the original.",
  });
  expect(
    (await call(candidate, "/api/public/files/" + document.id + "?text=true"))
      .text,
  ).toContain("Manually corrected");
  await call(admin, "/api/workspace/applications/" + appId + "/note", org.id, {
    body: "Unique review evidence amberlighthouse.",
  });
  expect(
    (await call(admin, "/api/workspace/search?q=amberlighthouse", org.id)).some(
      (s: any) => s.type === "note",
    ),
  ).toBe(true);
  const dep = await call(admin, "/api/workspace/settings/department", org.id, {
    name: "Unique Department " + suffix,
  });
  expect(
    (await call(admin, "/api/workspace/search?q=Unique", org.id)).some(
      (s: any) => s.id === dep.id,
    ),
  ).toBe(true);
  await call(admin, "/api/workspace/applications/bulk", org.id, {
    applications: [{ id: appId, version: detail.application.version }],
    action: "assign",
    owner_id: user.user.id,
  });
  await call(
    admin,
    "/api/workspace/applications/bulk",
    org.id,
    {
      applications: [{ id: appId, version: detail.application.version }],
      action: "draft_message",
      body: "A stale draft request must not apply.",
    },
    409,
  );
  detail = await call(admin, "/api/workspace/applications/" + appId, org.id);
  await call(admin, "/api/workspace/applications/bulk", org.id, {
    applications: [{ id: appId, version: detail.application.version }],
    action: "draft_message",
    body: "Thank you for applying. We will follow up through your portal.",
  });
  const messages = await call(admin, "/api/workspace/messages", org.id);
  expect((await call(candidate, "/api/public/portal")).messages).toHaveLength(
    0,
  );
  await call(admin, "/api/workspace/messages/" + messages[0].id, org.id, {
    body: "Thank you for applying. Your next steps are available here.",
    state: "portal",
  });
  expect((await call(candidate, "/api/public/portal")).messages).toHaveLength(
    1,
  );
  await call(
    admin,
    "/api/workspace/messages/" + messages[0].id,
    org.id,
    { body: "Attempt to rewrite a sent message.", state: "draft" },
    409,
  );
  await call(admin, "/api/workspace/message-templates", org.id, {
    name: "Acknowledgement QA",
    body: "Thank you for applying. We look forward to reviewing your work.",
  });
  expect(
    (await call(admin, "/api/workspace/message-templates", org.id))[0].name,
  ).toBe("Acknowledgement QA");
  const task = await call(admin, "/api/workspace/tasks", org.id, {
    title: "Review this application QA",
    application_id: appId,
    assignee_id: user.user.id,
    due_at: new Date(Date.now() - 86400000).toISOString(),
  });
  expect(
    (await call(admin, "/api/workspace/notifications", org.id)).items.some(
      (i: any) => i.id === task.id,
    ),
  ).toBe(true);
  await call(admin, "/api/workspace/notifications", org.id, {
    show_tasks: false,
    show_feedback: true,
  });
  expect(
    (await call(admin, "/api/workspace/notifications", org.id)).items.some(
      (i: any) => i.id === task.id,
    ),
  ).toBe(false);
  await call(admin, "/api/workspace/tasks/" + task.id, org.id, {
    status: "done",
  });
  const template = await call(admin, "/api/workspace/templates", org.id, {
    name: "Database skills QA",
    criteria: ["Query design", "Data integrity"],
  });
  const starts = new Date(Date.now() + 3 * 86400000).toISOString();
  const interview = await call(admin, "/api/workspace/interviews", org.id, {
    application_id: appId,
    interviewer_id: user.user.id,
    title: "Database discussion QA",
    type: "Video",
    starts_at: starts,
    duration: 30,
    timezone: "Asia/Kolkata",
    location: "",
    instructions: "Discuss a real project.",
    template_id: template.id,
  });
  expect(interview.scorecard_criteria).toEqual([
    "Query design",
    "Data integrity",
  ]);
  const ics = await candidate.request.get("/api/self/calendar/" + interview.id);
  expect(ics.status()).toBe(200);
  expect(await ics.text()).toContain("BEGIN:VEVENT");
  await call(admin, "/api/workspace/interviews/" + interview.id, org.id, {
    application_id: appId,
    interviewer_id: user.user.id,
    title: "Database discussion rescheduled QA",
    type: "Video",
    starts_at: new Date(Date.now() + 4 * 86400000).toISOString(),
    duration: 30,
    timezone: "Asia/Kolkata",
    location: "",
    instructions: "Discuss a real project.",
  });
  await call(
    admin,
    "/api/workspace/interviews/" + interview.id + "/scorecard",
    org.id,
    {
      ratings: { "Query design": 4, "Data integrity": 5 },
      body: "Used explicit transactions and explained a consistent authorization model.",
      recommendation: "Yes",
      submitted: false,
    },
  );
  await call(
    admin,
    "/api/workspace/interviews/" + interview.id + "/scorecard",
    org.id,
    {
      ratings: { "Query design": 4, "Data integrity": 5 },
      body: "Used explicit transactions and explained a consistent authorization model.",
      recommendation: "Yes",
      submitted: true,
    },
  );
  for (const stage of [
    "Screening",
    "Assessment",
    "Interview",
    "Final Review",
  ]) {
    detail = await call(admin, "/api/workspace/applications/" + appId, org.id);
    await call(
      admin,
      "/api/workspace/applications/" + appId + "/stage",
      org.id,
      { stage, version: detail.application.version },
    );
  }
  await call(
    admin,
    "/api/workspace/applications/" + appId + "/decision",
    org.id,
    {
      outcome: "advance",
      evidence:
        "Specific interview examples demonstrate secure database design and thoughtful collaboration.",
    },
  );
  detail = await call(admin, "/api/workspace/applications/" + appId, org.id);
  expect(detail.decisions).toHaveLength(1);
  const profile = (await call(candidate, "/api/self/profile")).profiles[0];
  const talentPool = await call(admin, "/api/workspace/pools", org.id, {
    name: "Future engineering",
    description: "Consenting engineering candidates.",
  });
  await call(admin, "/api/workspace/pools/" + talentPool.id, org.id, {
    candidate_id: profile.id,
    action: "add",
  });
  expect((await call(admin, "/api/workspace/pools", org.id))[0].people).toBe(1);
  expect(
    (await call(admin, "/api/workspace/talent", org.id))[0].pool_ids,
  ).toContain(talentPool.id);
  await call(candidate, "/api/self/profile", undefined, {
    candidate_id: profile.id,
    name: "Operations Candidate",
    phone: "",
    experience: "Updated experience supplied by the candidate.",
    skills: ["PostgreSQL"],
    availability: "Monday afternoons, Asia/Kolkata.",
    talent_consent: false,
  });
  expect(await call(admin, "/api/workspace/talent", org.id)).toHaveLength(0);
  expect((await call(admin, "/api/workspace/pools", org.id))[0].people).toBe(0);
  expect(
    (await call(admin, "/api/workspace/applications/" + appId, org.id))
      .application.availability,
  ).toContain("Monday");
  const exported = await candidate.request.get("/api/self/export");
  expect(exported.status()).toBe(200);
  expect((await exported.json()).applications[0].id).toBe(appId);
  const privacy = await call(candidate, "/api/self/privacy", undefined, {
    candidate_id: profile.id,
    kind: "erasure",
    body: "Please erase my fictional QA recruitment information.",
  });
  await call(admin, "/api/workspace/privacy/" + privacy.id, org.id, {
    erase: true,
    resolution:
      "Approved QA erasure after verifying no completed hire or retention obligation.",
  });
  detail = await call(admin, "/api/workspace/applications/" + appId, org.id);
  expect(detail.application.name).toBe("Redacted candidate");
  expect(detail.documents).toHaveLength(0);
  expect(detail.decisions[0].evidence).toContain("Removed");
  const denied = await candidate.request.get(
    "/api/public/files/" + document.id,
  );
  expect(denied.status()).toBe(404);
  const page = await admin.newPage();
  await page.goto("/workspace/notifications?org=" + org.id);
  await expect(
    page.getByRole("heading", { name: "A little nudge forward." }),
  ).toBeVisible();
  await page.goto("/workspace/messages?org=" + org.id);
  await page.getByText("Message templates · 1", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Acknowledgement QA" }),
  ).toBeVisible();
  await page.goto("/forgot-password");
  await expect(
    page.getByText(/Email delivery is not configured/),
  ).toBeVisible();
  await admin.close();
  await candidate.close();
});
