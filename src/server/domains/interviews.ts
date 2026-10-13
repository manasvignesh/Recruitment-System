import { z } from "zod";
import { pool, transaction } from "../db";
import { allow, appAccess, HttpError, type Context } from "../security";
import { audit } from "../audit";
export const criteria = [
  "Role expertise",
  "Problem solving",
  "Communication",
  "Collaboration",
];
export async function interviews(ctx: Context, req: Request, path: string[]) {
  if (req.method === "GET")
    return (
      await pool.query(
        `select i.*,c.name as candidate,j.title as job_title,u.name as interviewer,(select count(*)::int from morrow.scorecards s where s.interview_id=i.id and s.submitted=true) as feedback_count from morrow.interviews i join morrow.applications a on a.id=i.application_id join morrow.candidates c on c.id=a.candidate_id join morrow.jobs j on j.id=a.job_id join morrow.users u on u.id=i.interviewer_id where i.org_id=$1 and ($2 in ('admin','recruiter') or ($2='manager' and j.manager_id=$3) or i.interviewer_id=$3) order by starts_at desc limit 100`,
        [ctx.orgId, ctx.role, ctx.user.id],
      )
    ).rows;
  const input = await req.json();
  const id = path[0];
  if (id) {
    z.uuid().parse(id);
    const i = (
      await pool.query(
        "select * from morrow.interviews where id=$1 and org_id=$2",
        [id, ctx.orgId],
      )
    ).rows[0];
    if (!i) throw new HttpError(404, "Interview not found.");
    await appAccess(ctx, i.application_id);
    if (path[1] === "scorecard") {
      if (i.interviewer_id !== ctx.user.id)
        throw new HttpError(
          403,
          "Only the assigned interviewer can submit feedback.",
        );
      const d = z
        .object({
          ratings: z.record(z.string(), z.number().int().min(1).max(5)),
          body: z.string().trim().min(10).max(10000),
          recommendation: z.enum(["Strong yes", "Yes", "Discuss", "No"]),
          submitted: z.boolean(),
        })
        .parse(input);
      if ((i.scorecard_criteria || criteria).some((k: string) => !d.ratings[k]))
        throw new HttpError(422, "Rate each competency.");
      return transaction(async (c) => {
        await c.query(
          "select id from morrow.interviews where id=$1 for update",
          [id],
        );
        const previous = (
          await c.query(
            "select * from morrow.scorecards where interview_id=$1 and author_id=$2",
            [id, ctx.user.id],
          )
        ).rows[0];
        if (previous?.submitted)
          throw new HttpError(409, "Submitted feedback is locked.");
        await c.query(
          "insert into morrow.scorecards(org_id,interview_id,author_id,ratings,body,recommendation,submitted) values($1,$2,$3,$4,$5,$6,$7) on conflict(interview_id,author_id) do update set ratings=excluded.ratings,body=excluded.body,recommendation=excluded.recommendation,submitted=excluded.submitted,updated_at=now()",
          [
            ctx.orgId,
            id,
            ctx.user.id,
            JSON.stringify(d.ratings),
            d.body,
            d.recommendation,
            d.submitted,
          ],
        );
        if (d.submitted)
          await c.query(
            "update morrow.interviews set status='completed' where id=$1",
            [id],
          );
        await audit(
          c,
          ctx,
          "application",
          i.application_id,
          d.submitted ? "Feedback submitted" : "Feedback draft saved",
          { interview: id },
        );
        return { ok: true };
      });
    }
    allow(ctx, ["admin", "recruiter"]);
    if (path[1] === "cancel")
      return transaction(async (c) => {
        const r = await c.query(
          "update morrow.interviews set status='cancelled' where id=$1 and status='scheduled' returning id",
          [id],
        );
        if (!r.rows[0])
          throw new HttpError(
            409,
            "Only scheduled interviews can be cancelled.",
          );
        await audit(
          c,
          ctx,
          "application",
          i.application_id,
          "Interview cancelled",
          { title: i.title },
          true,
        );
        return { ok: true };
      });
  }
  allow(ctx, ["admin", "recruiter"]);
  const d = z
    .object({
      application_id: z.uuid(),
      interviewer_id: z.uuid(),
      title: z.string().min(3).max(150),
      type: z.enum(["Video", "Phone", "On-site"]),
      starts_at: z.iso.datetime({ offset: true }),
      duration: z.number().int().min(15).max(240),
      timezone: z.string().max(100),
      location: z.string().max(500),
      instructions: z.string().max(4000),
      template_id: z.uuid().nullable().optional(),
    })
    .parse(input);
  try {
    new Intl.DateTimeFormat("en", { timeZone: d.timezone });
  } catch {
    throw new HttpError(422, "Choose a valid timezone.");
  }
  const a = await appAccess(ctx, d.application_id);
  if (a.status !== "active")
    throw new HttpError(422, "Only active applications can be interviewed.");
  if (new Date(d.starts_at).getTime() < Date.now())
    throw new HttpError(422, "Choose a future interview time.");
  return transaction(async (c) => {
    if (
      !(
        await c.query(
          "select 1 from morrow.memberships where org_id=$1 and user_id=$2",
          [ctx.orgId, d.interviewer_id],
        )
      ).rows[0]
    )
      throw new HttpError(422, "Interviewer must belong to this organization.");
    await c.query("select pg_advisory_xact_lock(hashtext($1))", [
      d.interviewer_id,
    ]);
    await c.query("select pg_advisory_xact_lock(hashtext($1))", [
      d.application_id,
    ]);
    const conflict = await c.query(
      "select id from morrow.interviews where org_id=$1 and status='scheduled' and (interviewer_id=$2 or application_id=$3) and ($6::uuid is null or id<>$6) and starts_at < $4::timestamptz+($5 * interval '1 minute') and starts_at+(duration*interval '1 minute') > $4::timestamptz",
      [
        ctx.orgId,
        d.interviewer_id,
        d.application_id,
        d.starts_at,
        d.duration,
        id ?? null,
      ],
    );
    if (conflict.rows.length)
      throw new HttpError(
        409,
        "The candidate or interviewer already has an interview at this time.",
      );
    let r;
    const vals = [
      d.application_id,
      d.interviewer_id,
      d.title,
      d.type,
      d.starts_at,
      d.duration,
      d.timezone,
      d.location,
      d.instructions,
    ];
    if (id) {
      const old = (
        await c.query(
          "select * from morrow.interviews where id=$1 for update",
          [id],
        )
      ).rows[0];
      if (old.status !== "scheduled")
        throw new HttpError(
          409,
          "Only scheduled interviews can be rescheduled.",
        );
      r = (
        await c.query(
          "update morrow.interviews set application_id=$1,interviewer_id=$2,title=$3,type=$4,starts_at=$5,duration=$6,timezone=$7,location=$8,instructions=$9 where id=$10 returning *",
          [...vals, id],
        )
      ).rows[0];
    } else {
      let snapshot = criteria;
      if (d.template_id) {
        const template = (
          await c.query(
            "select criteria from morrow.scorecard_templates where org_id=$1 and id=$2",
            [ctx.orgId, d.template_id],
          )
        ).rows[0];
        if (!template)
          throw new HttpError(422, "Evaluation template not found.");
        snapshot = template.criteria;
      }
      r = (
        await c.query(
          "insert into morrow.interviews(application_id,interviewer_id,title,type,starts_at,duration,timezone,location,instructions,org_id,scorecard_criteria) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *",
          [...vals, ctx.orgId, JSON.stringify(snapshot)],
        )
      ).rows[0];
    }
    await audit(
      c,
      ctx,
      "application",
      d.application_id,
      id ? "Interview rescheduled" : "Interview scheduled",
      { title: d.title, starts_at: d.starts_at },
      true,
    );
    return r;
  });
}
