import { z } from "zod";
import { pool, transaction } from "../db";
import { audit } from "../audit";
import type { Context } from "../security";
export async function notifications(ctx: Context, req: Request) {
  if (req.method === "POST") {
    const d = z
      .object({ show_tasks: z.boolean(), show_feedback: z.boolean() })
      .parse(await req.json());
    return transaction(async (c) => {
      await c.query(
        "insert into morrow.notification_preferences(org_id,user_id,show_tasks,show_feedback) values($1,$2,$3,$4) on conflict(org_id,user_id) do update set show_tasks=excluded.show_tasks,show_feedback=excluded.show_feedback",
        [ctx.orgId, ctx.user.id, d.show_tasks, d.show_feedback],
      );
      await audit(
        c,
        ctx,
        "user",
        ctx.user.id,
        "Notification preferences updated",
      );
      return { ok: true };
    });
  }
  const preferences = (
    await pool.query(
      "select show_tasks,show_feedback from morrow.notification_preferences where org_id=$1 and user_id=$2",
      [ctx.orgId, ctx.user.id],
    )
  ).rows[0] || { show_tasks: true, show_feedback: true };
  const items = (
    await pool.query(
      `select t.id,'task' as type,t.title,t.application_id,t.due_at as created_at from morrow.tasks t where t.org_id=$1 and t.assignee_id=$2 and t.status='open' and $4=true union all select i.id,'feedback',i.title || ': feedback needed',i.application_id,i.starts_at from morrow.interviews i where i.org_id=$1 and i.interviewer_id=$2 and i.status='scheduled' and i.starts_at<now() and $5=true and not exists(select 1 from morrow.scorecards s where s.interview_id=i.id and s.submitted=true) union all select j.id,'approval','Approve position: ' || j.title,null,j.updated_at from morrow.jobs j where j.org_id=$1 and j.status='pending' and ($3='admin' or ($3='manager' and j.manager_id=$2)) union all select o.id,'approval','Approve offer: ' || c.name,o.application_id,o.updated_at from morrow.offers o join morrow.applications a on a.id=o.application_id join morrow.jobs j on j.id=a.job_id join morrow.candidates c on c.id=a.candidate_id where o.org_id=$1 and o.status='pending' and ($3='admin' or ($3='manager' and j.manager_id=$2)) order by created_at limit 100`,
      [
        ctx.orgId,
        ctx.user.id,
        ctx.role,
        preferences.show_tasks,
        preferences.show_feedback,
      ],
    )
  ).rows;
  return { preferences, items };
}
