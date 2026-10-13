import "dotenv/config";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
const base = process.env.APP_BASE_URL || "http://localhost:3000";
const suffix = randomUUID().slice(0, 8),
  password = "QA-Performance-" + randomUUID();
const registration = await fetch(base + "/api/auth/sign-up/email", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({
    name: "QA Performance Admin",
    email: `qa-performance-${suffix}@example.invalid`,
    password,
  }),
});
if (!registration.ok)
  throw Error(
    "Performance account could not be created. Run after authentication throttles expire.",
  );
const user = (await registration.json()).user;
const cookie = registration.headers
  .getSetCookie()
  .map((s) => s.split(";")[0])
  .join("; ");
const created = await fetch(base + "/api/workspace/organizations", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base, Cookie: cookie },
  body: JSON.stringify({
    name: "QA Performance " + suffix,
    slug: "qa-performance-" + suffix,
    description:
      "Isolated synthetic data for a read-only performance benchmark.",
  }),
});
if (!created.ok) throw Error("Performance organization setup failed.");
const org = await created.json();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("update morrow.organizations set is_demo=true where id=$1", [
    org.id,
  ]);
  const jobs = Array.from({ length: 24 }, (_, i) => ({
    id: randomUUID(),
    title: "QA Performance Position " + String(i + 1).padStart(2, "0"),
  }));
  const people = Array.from({ length: 240 }, (_, i) => ({
    user_id: randomUUID(),
    candidate_id: randomUUID(),
    application_id: randomUUID(),
    name: "QA Applicant " + String(i + 1).padStart(3, "0"),
    email: `qa-person-${i}-${suffix}@example.invalid`,
    job_id: jobs[i % jobs.length].id,
  }));
  await c.query(
    `insert into morrow.jobs(id,org_id,title,manager_id,location,workplace,employment,openings,description,requirements,skills,status,created_by,approved_by,published_at) select r.id,$1,r.title,$2,'Remote','Remote','Full-time',2,'Isolated synthetic QA position used to verify bounded recruitment queries.','PostgreSQL and TypeScript experience.','{PostgreSQL,TypeScript}','published',$2,$2,now() from jsonb_to_recordset($3::jsonb) as r(id uuid,title text)`,
    [org.id, user.id, JSON.stringify(jobs)],
  );
  await c.query(
    `insert into morrow.users(id,name,email) select r.user_id,r.name,r.email from jsonb_to_recordset($1::jsonb) as r(user_id uuid,name text,email text)`,
    [JSON.stringify(people)],
  );
  await c.query(
    `insert into morrow.candidates(id,org_id,user_id,name,email,skills,experience) select r.candidate_id,$1,r.user_id,r.name,r.email,'{PostgreSQL,TypeScript}','Synthetic QA profile for query validation.' from jsonb_to_recordset($2::jsonb) as r(candidate_id uuid,user_id uuid,name text,email text)`,
    [org.id, JSON.stringify(people)],
  );
  await c.query(
    `insert into morrow.applications(id,org_id,job_id,candidate_id,owner_id,source) select r.application_id,$1,r.job_id,r.candidate_id,$2,'QA Performance' from jsonb_to_recordset($3::jsonb) as r(application_id uuid,job_id uuid,candidate_id uuid)`,
    [org.id, user.id, JSON.stringify(people)],
  );
  await c.query(
    `insert into morrow.application_stage_history(org_id,application_id,to_stage,actor_id) select $1,r.application_id,'Applied',r.user_id from jsonb_to_recordset($2::jsonb) as r(application_id uuid,user_id uuid)`,
    [org.id, JSON.stringify(people)],
  );
  await c.query("COMMIT");
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  c.release();
  await pool.end();
}
const measurements: { name: string; ms: number; status: number }[] = [];
async function measure(name: string, path: string) {
  const start = performance.now();
  const r = await fetch(base + "/api/workspace/" + path, {
    headers: { Cookie: cookie, "x-organization-id": org.id },
  });
  const data = await r.json();
  const ms = Math.round(performance.now() - start);
  measurements.push({ name, ms, status: r.status });
  if (!r.ok) throw Error(name + ": " + data.error);
  if (ms > 15000) throw Error(name + " exceeded the 15-second smoke budget.");
  return data;
}
await measure("reference", "reference");
const positions = await measure("24-position list", "jobs");
if (positions.length !== 24) throw Error("Position count mismatch.");
const first = await measure("applications page 1", "applications?page=1"),
  second = await measure("applications page 2", "applications?page=2");
if (
  first.total !== 240 ||
  first.items.length !== 50 ||
  second.items.length !== 50
)
  throw Error("Pagination mismatch.");
if (
  first.items.some((a: { id: string }) =>
    second.items.some((b: { id: string }) => a.id === b.id),
  )
)
  throw Error("Pagination returned overlapping rows.");
const search = await measure("indexed candidate search", "search?q=150");
if (!search.some((r: { label: string }) => r.label === "QA Applicant 150"))
  throw Error("Search mismatch.");
const metrics = await measure("cohort analytics", "analytics");
if (metrics.metrics.applications !== 240) throw Error("Cohort count mismatch.");
await measure("hiring pulse", "pulse");
const report = {
  organization: org.name,
  records: { jobs: 24, candidates: 240, applications: 240 },
  budget:
    "Each authenticated API response under 15 seconds; bounded application pages of 50.",
  measurements,
  limitations:
    "Single-client API smoke benchmark including remote Neon latency. Not a concurrent load test or Web Vitals measurement.",
};
writeFileSync("test-results/performance.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
