import { z } from "zod";
import { pool, transaction } from "../db";
import { allow, jobAccess, HttpError, type Context } from "../security";
import { audit } from "../audit";
import { canTransition, jobTransitions } from "../rules";
const jobInput = z
  .object({
    title: z.string().trim().min(3).max(150),
    department_id: z.uuid().nullable(),
    manager_id: z.uuid(),
    location: z.string().min(2).max(150),
    workplace: z.enum(["Remote", "Hybrid", "On-site"]),
    employment: z.enum(["Full-time", "Part-time", "Contract", "Internship"]),
    openings: z.number().int().min(1).max(100),
    salary_min: z.number().int().min(0).nullable(),
    salary_max: z.number().int().min(0).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    description: z.string().min(30).max(20000),
    requirements: z.string().max(10000),
    skills: z.array(z.string().max(100)).max(30),
    questions: z.array(z.string().min(2).max(500)).max(10),
    closing_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .refine(
    (d) =>
      d.salary_min === null ||
      d.salary_max === null ||
      d.salary_max >= d.salary_min,
    { message: "Maximum salary must be at least the minimum." },
  );
export async function jobs(ctx: Context, req: Request, path: string[]) {
  const id = path[0];
  if (req.method === "GET") {
    if (id) return jobAccess(ctx, id);
    return (
      await pool.query(
        `select j.*,d.name as department,(select count(*)::int from morrow.applications a where a.job_id=j.id) as application_count,(select count(*)::int from morrow.applications a where a.job_id=j.id and a.status='hired') as hired_count from morrow.jobs j left join morrow.departments d on d.id=j.department_id where j.org_id=$1 and ($2 in ('admin','recruiter') or j.manager_id=$3 or exists(select 1 from morrow.interviews i join morrow.applications a on a.id=i.application_id where a.job_id=j.id and i.interviewer_id=$3)) order by j.updated_at desc limit 100`,
        [ctx.orgId, ctx.role, ctx.user.id],
      )
    ).rows;
  }
  const input = await req.json();
  if (id && path[1] === "status") {
    await jobAccess(ctx, id);
    const d = z
      .object({ status: z.string(), version: z.number().int() })
      .parse(input);
    return transaction(async (c) => {
      const j = (
        await c.query(
          "select * from morrow.jobs where id=$1 and org_id=$2 for update",
          [id, ctx.orgId],
        )
      ).rows[0];
      if (j.version !== d.version)
        throw new HttpError(
          409,
          "This job changed. Refresh before continuing.",
        );
      if (!canTransition(jobTransitions, j.status, d.status))
        throw new HttpError(422, "This job transition is not allowed.");
      if (d.status === "approved" && j.status === "pending") {
        allow(ctx, ["admin", "manager"]);
        if (ctx.role === "manager" && j.manager_id !== ctx.user.id)
          throw new HttpError(
            403,
            "Only the assigned hiring manager can approve.",
          );
      } else allow(ctx, ["admin", "recruiter"]);
      await c.query(
        "update morrow.jobs set status=$1,approved_by=case when $1='approved' and status='pending' then $2 else approved_by end,published_at=case when $1='published' then coalesce(published_at,now()) else published_at end,version=version+1,updated_at=now() where id=$3",
        [d.status, ctx.user.id, id],
      );
      await audit(c, ctx, "job", id, `Job ${d.status}`, {
        from: j.status,
        to: d.status,
      });
      return { ok: true };
    });
  }
  allow(ctx, ["admin", "recruiter"]);
  const d = jobInput.parse(input);
  if (id) await jobAccess(ctx, id);
  return transaction(async (c) => {
    const m = await c.query(
      "select 1 from morrow.memberships where org_id=$1 and user_id=$2 and role in ('admin','manager')",
      [ctx.orgId, d.manager_id],
    );
    if (!m.rows[0])
      throw new HttpError(
        422,
        "Select an administrator or hiring manager in this organization.",
      );
    const vals = [
      d.title,
      d.department_id,
      d.manager_id,
      d.location,
      d.workplace,
      d.employment,
      d.openings,
      d.salary_min,
      d.salary_max,
      d.currency,
      d.description,
      d.requirements,
      d.skills,
      JSON.stringify(d.questions),
      d.closing_date,
    ];
    let j;
    if (id) {
      const old = (
        await c.query("select * from morrow.jobs where id=$1 for update", [id])
      ).rows[0];
      if (!["draft", "approved"].includes(old.status))
        throw new HttpError(409, "Return the job to draft before editing.");
      if (old.version !== input.version)
        throw new HttpError(409, "This job has changed. Refresh to edit.");
      j = (
        await c.query(
          "update morrow.jobs set title=$1,department_id=$2,manager_id=$3,location=$4,workplace=$5,employment=$6,openings=$7,salary_min=$8,salary_max=$9,currency=$10,description=$11,requirements=$12,skills=$13,questions=$14,closing_date=$15,status='draft',approved_by=null,version=version+1,updated_at=now() where id=$16 returning *",
          [...vals, id],
        )
      ).rows[0];
    } else
      j = (
        await c.query(
          "insert into morrow.jobs(title,department_id,manager_id,location,workplace,employment,openings,salary_min,salary_max,currency,description,requirements,skills,questions,closing_date,org_id,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning *",
          [...vals, ctx.orgId, ctx.user.id],
        )
      ).rows[0];
    await audit(c, ctx, "job", j.id, id ? "Job edited" : "Requisition created");
    return j;
  });
}
