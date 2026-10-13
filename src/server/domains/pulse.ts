import { pool } from "../db";
import type { Context } from "../security";
export async function pulse(ctx: Context) {
  if (ctx.role === "interviewer") return [];
  return (
    await pool.query(
      `with positions as(select * from morrow.jobs where org_id=$1 and ($2 in ('admin','recruiter') or manager_id=$3)) select j.id as job_id,j.title,'stalled' as kind,count(a.id)::int as count,min(a.stage_entered_at) as since,(array_agg(a.id order by a.stage_entered_at))[1] as application_id from positions j join morrow.applications a on a.job_id=j.id where a.status='active' and a.stage_entered_at<now()-interval '5 days' group by j.id,j.title union all select j.id,j.title,'quiet',0,j.published_at,null from positions j where j.status='published' and j.published_at<now()-interval '7 days' and not exists(select 1 from morrow.applications a where a.job_id=j.id and a.created_at>now()-interval '7 days') union all select j.id,j.title,'deadline',0,j.closing_date::timestamptz,null from positions j where j.status='published' and j.closing_date between current_date and current_date+7 union all select j.id,j.title,'feedback',count(i.id)::int,min(i.starts_at),(array_agg(a.id order by i.starts_at))[1] from positions j join morrow.applications a on a.job_id=j.id join morrow.interviews i on i.application_id=a.id where i.status='scheduled' and i.starts_at<now() and not exists(select 1 from morrow.scorecards s where s.interview_id=i.id and s.submitted=true) group by j.id,j.title union all select j.id,j.title,'offer',count(o.id)::int,min(o.updated_at),(array_agg(a.id order by o.updated_at))[1] from positions j join morrow.applications a on a.job_id=j.id join morrow.offers o on o.application_id=a.id where o.status='pending' group by j.id,j.title order by since limit 30`,
      [ctx.orgId, ctx.role, ctx.user.id],
    )
  ).rows;
}
