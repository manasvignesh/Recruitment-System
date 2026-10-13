import { pool } from "../db";
import { allow, type Context } from "../security";
import { z } from "zod";
export async function analytics(ctx: Context, req: Request) {
  allow(ctx, ["admin", "recruiter", "manager"]);
  const params = new URL(req.url).searchParams;
  const start = params.get("from") || "2000-01-01",
    end = params.get("to") || "2100-01-01",
    job = params.get("job") || null,
    department = params.get("department") || null,
    recruiter = params.get("recruiter") || null;
  if (job) z.uuid().parse(job);
  if (department) z.uuid().parse(department);
  if (recruiter) z.uuid().parse(recruiter);
  z.iso.date().parse(start);
  z.iso.date().parse(end);
  const scope = [
    ctx.orgId,
    ctx.role,
    ctx.user.id,
    start,
    end,
    job,
    department,
    recruiter,
  ];
  const where =
    "a.org_id=$1 and ($2 in ('admin','recruiter') or j.manager_id=$3) and a.created_at >= $4::date and a.created_at < $5::date+interval '1 day' and ($6::uuid is null or a.job_id=$6) and ($7::uuid is null or j.department_id=$7) and ($8::uuid is null or a.owner_id=$8)";
  const funnel = (
    await pool.query(
      `select a.stage,count(*)::int as count,round(avg(extract(epoch from (now()-a.stage_entered_at))/86400)::numeric,1) as days from morrow.applications a join morrow.jobs j on j.id=a.job_id where ${where} group by a.stage order by count desc`,
      scope,
    )
  ).rows;
  const metrics = (
    await pool.query(
      `select count(*)::int as applications,count(*) filter(where a.status='hired')::int as hires,count(*) filter(where a.status='withdrawn')::int as withdrawals,round(avg(extract(epoch from (a.hired_at-a.created_at))/86400) filter(where a.status='hired')::numeric,1) as time_to_hire from morrow.applications a join morrow.jobs j on j.id=a.job_id where ${where}`,
      scope,
    )
  ).rows[0];
  const sources = (
    await pool.query(
      `select a.source,count(*)::int as count from morrow.applications a join morrow.jobs j on j.id=a.job_id where ${where} group by source`,
      scope,
    )
  ).rows;
  const offers = (
    await pool.query(
      `select count(*) filter(where o.status in ('accepted','declined','expired'))::int as resolved,count(*) filter(where o.status='accepted')::int as accepted,count(*) filter(where o.status='pending')::int as pending from morrow.offers o join morrow.applications a on a.id=o.application_id join morrow.jobs j on j.id=a.job_id where ${where}`,
      scope,
    )
  ).rows[0];
  const jobs = (
    await pool.query(
      "select count(*) filter(where status='published')::int as active,count(*)::int as total from morrow.jobs where org_id=$1 and ($2 in ('admin','recruiter') or manager_id=$3) and ($4::uuid is null or id=$4) and ($5::uuid is null or department_id=$5)",
      [ctx.orgId, ctx.role, ctx.user.id, job, department],
    )
  ).rows[0];
  const interviews = (
    await pool.query(
      `select count(*)::int as total,count(*) filter(where i.status='completed')::int as completed from morrow.interviews i join morrow.applications a on a.id=i.application_id join morrow.jobs j on j.id=a.job_id where ${where} and i.status<>'cancelled'`,
      scope,
    )
  ).rows[0];
  const trends = (
    await pool.query(
      `select to_char(date_trunc('week',a.created_at),'YYYY-MM-DD') as week,count(*)::int as count from morrow.applications a join morrow.jobs j on j.id=a.job_id where ${where} group by 1 order by 1`,
      scope,
    )
  ).rows;
  const [conversion, stageDurations, turnaround, timeToFill, overdue] =
    await Promise.all([
      pool.query(
        `select h.to_stage as stage,count(distinct a.id)::int as reached from morrow.application_stage_history h join morrow.applications a on a.id=h.application_id join morrow.jobs j on j.id=a.job_id where ${where} group by h.to_stage`,
        scope,
      ),
      pool.query(
        `with intervals as(select h.to_stage as stage,h.created_at,lead(h.created_at) over(partition by h.application_id order by h.created_at,h.id) as next_at from morrow.application_stage_history h join morrow.applications a on a.id=h.application_id join morrow.jobs j on j.id=a.job_id where ${where}) select stage,round(avg(extract(epoch from(next_at-created_at))/86400)::numeric,1) as days from intervals where next_at is not null group by stage`,
        scope,
      ),
      pool.query(
        `select count(*)::int as completed,round(avg(greatest(0,extract(epoch from(s.updated_at-i.starts_at-(i.duration*interval '1 minute')))/3600))::numeric,1) as hours from morrow.scorecards s join morrow.interviews i on i.id=s.interview_id join morrow.applications a on a.id=i.application_id join morrow.jobs j on j.id=a.job_id where ${where} and s.submitted=true`,
        scope,
      ),
      pool.query(
        `select round(avg(extract(epoch from(f.filled_at-f.published_at))/86400)::numeric,1) as days from(select j.id,j.published_at,max(a.hired_at) as filled_at,j.openings from morrow.applications a join morrow.jobs j on j.id=a.job_id where ${where} and a.status='hired' and j.published_at is not null group by j.id,j.published_at,j.openings having count(*)>=j.openings) f`,
        scope,
      ),
      pool.query(
        "select count(*)::int as count from morrow.tasks where org_id=$1 and status='open' and due_at<now() and ($2 in ('admin','recruiter') or assignee_id=$3)",
        [ctx.orgId, ctx.role, ctx.user.id],
      ),
    ]);
  return {
    metrics,
    jobs,
    funnel,
    sources,
    offers,
    interviews,
    trends,
    conversion: conversion.rows,
    stageDurations: stageDurations.rows,
    turnaround: turnaround.rows[0],
    timeToFill: timeToFill.rows[0],
    overdue: overdue.rows[0].count,
    window: { from: start, to: end },
    definitions: {
      applications: "Applications submitted within the selected dates.",
      hires: "Hired applications submitted within the selected dates.",
      time_to_hire:
        "Mean days from application submission to hire, among hired applications in this cohort.",
      offer_acceptance:
        "Accepted / resolved offers in this application cohort; unresolved offers excluded.",
      interview_completion:
        "Completed / non-cancelled interviews for applications in this cohort.",
      days: "Mean elapsed days in the current stage; includes terminal applications.",
      conversion:
        "Distinct cohort applications ever reaching each stage / all cohort applications. A candidate may appear in several stages.",
      stage_duration:
        "Mean completed interval between recorded stage transitions; current unfinished intervals excluded.",
      feedback_turnaround:
        "Mean nonnegative hours from interview end to final scorecard submission for this cohort.",
      time_to_fill:
        "Mean days from first publication to last required hire for positions filled entirely by applications in this cohort.",
      overdue:
        "Current overdue open tasks in your authorized organization scope, independent of the application date filter.",
    },
  };
}
