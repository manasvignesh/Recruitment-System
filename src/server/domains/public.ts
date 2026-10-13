import { createHash } from "node:crypto";
import { z } from "zod";
import { pool, transaction } from "../db";
import { identity, HttpError, verifyOrigin } from "../security";
import { boundedForm, processUpload } from "./files";
import { attachmentStorage } from "../storage";
export async function careers(req: Request, path: string[]) {
  const slug = path[0],
    id = path[1];
  const org = (
    await pool.query(
      "select id,name,slug,description,is_demo from morrow.organizations where slug=$1",
      [slug],
    )
  ).rows[0];
  if (!org) throw new HttpError(404, "Careers page not found.");
  if (req.method === "GET") {
    const jobs = (
      await pool.query(
        "select j.id,j.title,j.location,j.workplace,j.employment,j.salary_min,j.salary_max,j.currency,j.description,j.requirements,j.skills,j.questions,j.closing_date,d.name as department from morrow.jobs j left join morrow.departments d on d.id=j.department_id where j.org_id=$1 and j.status='published' and (j.closing_date is null or j.closing_date>=current_date) and ($2::uuid is null or j.id=$2) order by j.published_at desc",
        [org.id, id || null],
      )
    ).rows;
    return { organization: org, jobs };
  }
  verifyOrigin(req);
  const user = await identity();
  z.uuid().parse(id);
  const form = await boundedForm(req);
  const d = z
    .object({
      name: z.string().trim().min(2).max(150),
      phone: z.string().max(50),
      experience: z.string().max(10000),
      skills: z.array(z.string().max(100)).max(30),
      answers: z.record(z.string(), z.string().max(4000)),
      talent_consent: z.boolean(),
      consent: z.literal(true),
    })
    .parse({
      name: form.get("name"),
      phone: form.get("phone") || "",
      experience: form.get("experience") || "",
      skills: String(form.get("skills") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      answers: JSON.parse(String(form.get("answers") || "{}")),
      talent_consent: form.get("talent_consent") === "true",
      consent: form.get("consent") === "true",
    });
  const file = form.get("resume");
  if (!(file instanceof File))
    throw new HttpError(422, "Upload a PDF or DOCX resume.");
  const upload = await processUpload(file);
  return transaction(async (c) => {
    const key = createHash("sha256")
      .update(user.id + ":apply")
      .digest("hex");
    const limit = (
      await c.query(
        "insert into morrow.submission_limits(key,count,window_start) values($1,1,now()) on conflict(key) do update set count=case when morrow.submission_limits.window_start<now()-interval '1 hour' then 1 else morrow.submission_limits.count+1 end,window_start=case when morrow.submission_limits.window_start<now()-interval '1 hour' then now() else morrow.submission_limits.window_start end returning count",
        [key],
      )
    ).rows[0];
    if (limit.count > 10)
      throw new HttpError(
        429,
        "Too many applications. Please try again in an hour.",
      );
    const job = (
      await c.query(
        "select * from morrow.jobs where id=$1 and org_id=$2 and status='published' and (closing_date is null or closing_date>=current_date) for share",
        [id, org.id],
      )
    ).rows[0];
    if (!job)
      throw new HttpError(409, "This job is no longer accepting applications.");
    if (job.questions.some((q: string) => !d.answers[q]?.trim()))
      throw new HttpError(422, "Answer each application question.");
    const candidate = (
      await c.query(
        "insert into morrow.candidates(org_id,user_id,name,email,phone,skills,experience,talent_consent) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(org_id,user_id) do update set name=excluded.name,phone=excluded.phone,skills=excluded.skills,experience=excluded.experience,talent_consent=excluded.talent_consent returning *",
        [
          org.id,
          user.id,
          d.name,
          user.email,
          d.phone,
          d.skills,
          d.experience,
          d.talent_consent,
        ],
      )
    ).rows[0];
    const app = (
      await c.query(
        "insert into morrow.applications(org_id,job_id,candidate_id,answers) values($1,$2,$3,$4) returning *",
        [org.id, id, candidate.id, JSON.stringify(d.answers)],
      )
    ).rows[0];
    await attachmentStorage.put(c, org.id, candidate.id, upload);
    await c.query(
      "insert into morrow.application_stage_history(org_id,application_id,to_stage,actor_id) values($1,$2,'Applied',$3)",
      [org.id, app.id, user.id],
    );
    await c.query(
      "insert into morrow.audit_events(org_id,actor_id,entity_type,entity_id,action,public) values($1,$2,'application',$3,'Application received',true)",
      [org.id, user.id, app.id],
    );
    return { id: app.id };
  });
}
export async function portal(req: Request, path: string[]) {
  const user = await identity();
  const id = path[0];
  if (req.method === "GET") {
    const applications = (
      await pool.query(
        "select a.id,a.status,a.stage,a.created_at,a.job_id,a.org_id,j.title,j.location,o.name as organization,o.slug from morrow.applications a join morrow.candidates c on c.id=a.candidate_id join morrow.jobs j on j.id=a.job_id join morrow.organizations o on o.id=a.org_id where c.user_id=$1 order by a.created_at desc",
        [user.id],
      )
    ).rows;
    const ids = applications.map((a) => a.id);
    return {
      user,
      applications,
      interviews: (
        await pool.query(
          "select id,application_id,title,type,starts_at,duration,timezone,location,instructions,status from morrow.interviews where application_id=any($1::uuid[]) order by starts_at",
          [ids],
        )
      ).rows,
      messages: (
        await pool.query(
          "select m.id,m.application_id,m.body,m.created_at,u.name as author from morrow.messages m join morrow.users u on u.id=m.author_id where m.application_id=any($1::uuid[]) and m.state='portal' order by m.created_at",
          [ids],
        )
      ).rows,
      offers: (
        await pool.query(
          "select id,application_id,compensation,currency,start_date,expires_at,terms,case when status='available' and expires_at<now() then 'expired' else status end as status,version from morrow.offers where application_id=any($1::uuid[]) and status in ('available','accepted','declined','expired')",
          [ids],
        )
      ).rows,
      history: (
        await pool.query(
          "select entity_id,action,created_at,detail from morrow.audit_events where entity_id=any($1::uuid[]) and public=true order by created_at",
          [ids],
        )
      ).rows,
      documents: (
        await pool.query(
          "select d.id,d.name,d.size,d.parsing_status from morrow.documents d join morrow.candidates c on c.id=d.candidate_id where c.user_id=$1",
          [user.id],
        )
      ).rows,
    };
  }
  verifyOrigin(req);
  z.uuid().parse(id);
  const a = (
    await pool.query(
      "select a.* from morrow.applications a join morrow.candidates c on c.id=a.candidate_id where a.id=$1 and c.user_id=$2",
      [id, user.id],
    )
  ).rows[0];
  if (!a) throw new HttpError(404, "Application not found.");
  const input = await req.json();
  return transaction(async (c) => {
    const locked = (
      await c.query(
        "select status from morrow.applications where id=$1 for update",
        [id],
      )
    ).rows[0];
    if (path[1] === "withdraw") {
      const current = (
        await c.query("select status from morrow.applications where id=$1", [
          id,
        ])
      ).rows[0];
      if (!["active", "hold"].includes(current.status))
        throw new HttpError(409, "This application cannot be withdrawn.");
      await c.query(
        "update morrow.applications set status='withdrawn',version=version+1,updated_at=now() where id=$1",
        [id],
      );
      await c.query(
        "update morrow.interviews set status='cancelled' where application_id=$1 and status='scheduled'",
        [id],
      );
      await c.query(
        "update morrow.offers set status='expired',version=version+1 where application_id=$1 and status in ('draft','pending','approved','available')",
        [id],
      );
    } else if (path[1] === "offer") {
      const d = z
        .object({
          response: z.enum(["accepted", "declined"]),
          version: z.number().int(),
        })
        .parse(input);
      const o = (
        await c.query(
          "select * from morrow.offers where application_id=$1 for update",
          [id],
        )
      ).rows[0];
      if (
        !o ||
        o.status !== "available" ||
        new Date(o.expires_at) < new Date() ||
        o.version !== d.version ||
        locked.status !== "active"
      )
        throw new HttpError(409, "This offer is no longer available.");
      await c.query(
        "update morrow.offers set status=$1,version=version+1,updated_at=now() where id=$2",
        [d.response, o.id],
      );
    } else if (path[1] === "message") {
      const d = z
        .object({ body: z.string().trim().min(2).max(10000) })
        .parse(input);
      await c.query(
        "insert into morrow.messages(org_id,application_id,author_id,body,state) values($1,$2,$3,$4,'portal')",
        [a.org_id, id, user.id, d.body],
      );
    } else throw new HttpError(404, "Action not found.");
    await c.query(
      "insert into morrow.audit_events(org_id,actor_id,entity_type,entity_id,action,public) values($1,$2,'application',$3,$4,true)",
      [
        a.org_id,
        user.id,
        id,
        path[1] === "offer"
          ? `Offer ${input.response}`
          : path[1] === "withdraw"
            ? "Application withdrawn"
            : "Message sent",
      ],
    );
    return { ok: true };
  });
}
