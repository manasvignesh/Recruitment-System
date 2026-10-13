import { z } from "zod";
import { pool, transaction } from "../db";
import { allow, appAccess, HttpError, type Context } from "../security";
import { audit } from "../audit";
import { stageAllowed } from "../rules";
export async function applications(ctx: Context, req: Request, path: string[]) {
  const id = path[0];
  const url = new URL(req.url);
  if (req.method === "GET") {
    if (id) {
      const application = await appAccess(ctx, id);
      const privateFeedback = ctx.role === "interviewer";
      return {
        application,
        pools: (
          await pool.query(
            "select p.id,p.name from morrow.talent_pools p join morrow.talent_pool_memberships m on m.pool_id=p.id where p.org_id=$1 and m.candidate_id=$2",
            [ctx.orgId, application.candidate_id],
          )
        ).rows,
        notes: (
          await pool.query(
            "select n.*,u.name as author from morrow.notes n join morrow.users u on u.id=n.author_id where n.org_id=$1 and n.application_id=$2 order by created_at desc",
            [ctx.orgId, id],
          )
        ).rows,
        history: (
          await pool.query(
            "select h.*,u.name as actor from morrow.application_stage_history h join morrow.users u on u.id=h.actor_id where h.org_id=$1 and h.application_id=$2 order by created_at desc",
            [ctx.orgId, id],
          )
        ).rows,
        events: (
          await pool.query(
            "select e.id,e.action,e.detail,e.created_at,u.name as actor from morrow.audit_events e join morrow.users u on u.id=e.actor_id where e.org_id=$1 and e.entity_type='application' and e.entity_id=$2 and e.action not in ('Stage changed','Application received') order by e.created_at desc limit 100",
            [ctx.orgId, id],
          )
        ).rows,
        interviews: (
          await pool.query(
            "select i.*,u.name as interviewer from morrow.interviews i join morrow.users u on u.id=i.interviewer_id where i.org_id=$1 and i.application_id=$2 order by starts_at",
            [ctx.orgId, id],
          )
        ).rows,
        scorecards: (
          await pool.query(
            `select s.*,u.name as author from morrow.scorecards s join morrow.interviews i on i.id=s.interview_id join morrow.users u on u.id=s.author_id where s.org_id=$1 and i.application_id=$2 and (s.author_id=$3 or ($4=false and s.submitted=true)) order by s.created_at desc`,
            [ctx.orgId, id, ctx.user.id, privateFeedback],
          )
        ).rows,
        documents: (
          await pool.query(
            "select id,name,mime,size,parsing_status,created_at from morrow.documents where org_id=$1 and candidate_id=$2",
            [ctx.orgId, application.candidate_id],
          )
        ).rows,
        messages: (
          await pool.query(
            "select m.*,u.name as author from morrow.messages m join morrow.users u on u.id=m.author_id where m.org_id=$1 and m.application_id=$2 order by created_at",
            [ctx.orgId, id],
          )
        ).rows,
        offers:
          ctx.role === "interviewer"
            ? []
            : (
                await pool.query(
                  "select * from morrow.offers where org_id=$1 and application_id=$2",
                  [ctx.orgId, id],
                )
              ).rows,
        decisions:
          ctx.role === "interviewer"
            ? []
            : (
                await pool.query(
                  "select d.*,u.name as actor from morrow.hiring_decisions d join morrow.users u on u.id=d.actor_id where d.org_id=$1 and d.application_id=$2 order by d.created_at desc",
                  [ctx.orgId, id],
                )
              ).rows,
        offerVersions:
          ctx.role === "interviewer"
            ? []
            : (
                await pool.query(
                  "select v.version,v.created_at,v.snapshot from morrow.offer_versions v join morrow.offers o on o.id=v.offer_id where v.org_id=$1 and o.application_id=$2 order by v.version desc",
                  [ctx.orgId, id],
                )
              ).rows,
        tasks: (
          await pool.query(
            "select t.*,u.name as assignee from morrow.tasks t join morrow.users u on u.id=t.assignee_id where t.org_id=$1 and t.application_id=$2",
            [ctx.orgId, id],
          )
        ).rows,
      };
    }
    const q = z
        .string()
        .max(100)
        .parse(url.searchParams.get("q") || ""),
      job = url.searchParams.get("job") || null,
      stage = url.searchParams.get("stage") || null,
      status = url.searchParams.get("status") || null;
    const page = Math.max(
      1,
      Math.min(10000, Number(url.searchParams.get("page")) || 1),
    );
    if (job) z.uuid().parse(job);
    const r = await pool.query(
      `select a.*,c.name,c.email,c.skills,c.talent_consent,j.title,j.department_id,d.name as department,u.name as owner,count(*) over()::int as total from morrow.applications a join morrow.candidates c on c.id=a.candidate_id join morrow.jobs j on j.id=a.job_id left join morrow.departments d on d.id=j.department_id left join morrow.users u on u.id=a.owner_id where a.org_id=$1 and ($2 in ('admin','recruiter') or ($2='manager' and j.manager_id=$3) or ($2='interviewer' and exists(select 1 from morrow.interviews i where i.application_id=a.id and i.interviewer_id=$3))) and ($4='' or to_tsvector('simple',c.name || ' ' || c.email || ' ' || c.experience) @@ plainto_tsquery('simple',$4) or c.name ilike '%' || $4 || '%') and ($5::uuid is null or a.job_id=$5) and ($6::text is null or a.stage=$6) and ($7::text is null or a.status=$7) and ($9=false or a.stage_entered_at<now()-interval '5 days') order by a.updated_at desc,a.id desc limit 50 offset $8`,
      [
        ctx.orgId,
        ctx.role,
        ctx.user.id,
        q,
        job,
        stage,
        status,
        (page - 1) * 50,
        url.searchParams.get("stalled") === "true",
      ],
    );
    return { items: r.rows, total: r.rows[0]?.total ?? 0, page };
  }
  if (!id) throw new HttpError(404, "Application not found.");
  const authorized = await appAccess(ctx, id);
  if (path[1] === "decision") {
    allow(ctx, ["admin", "manager"]);
    if (ctx.role === "manager" && authorized.manager_id !== ctx.user.id)
      throw new HttpError(
        403,
        "Only the assigned hiring manager can record a decision.",
      );
    const d = z
      .object({
        outcome: z.enum(["advance", "discuss", "decline"]),
        evidence: z.string().trim().min(20).max(10000),
      })
      .parse(await req.json());
    return transaction(async (c) => {
      const current = (
        await c.query(
          "select * from morrow.applications where id=$1 for update",
          [id],
        )
      ).rows[0];
      if (current.status !== "active" || current.stage !== "Final Review")
        throw new HttpError(
          422,
          "Record decisions for active candidates in Final Review.",
        );
      const decision = (
        await c.query(
          "insert into morrow.hiring_decisions(org_id,application_id,actor_id,outcome,evidence) values($1,$2,$3,$4,$5) returning *",
          [ctx.orgId, id, ctx.user.id, d.outcome, d.evidence],
        )
      ).rows[0];
      await audit(c, ctx, "application", id, "Hiring decision recorded", {
        outcome: d.outcome,
        decision: decision.id,
      });
      return decision;
    });
  }
  allow(ctx, ["admin", "recruiter"]);
  const input = await req.json();
  return transaction(async (c) => {
    if (path[1] === "stage")
      await c.query(
        "select id from morrow.organizations where id=$1 for share",
        [ctx.orgId],
      );
    const a = (
      await c.query(
        "select * from morrow.applications where org_id=$1 and id=$2 for update",
        [ctx.orgId, id],
      )
    ).rows[0];
    if (path[1] === "stage") {
      const d = z
        .object({ stage: z.string().min(2).max(40), version: z.number().int() })
        .parse(input);
      if (a.status !== "active")
        throw new HttpError(
          422,
          "Only active applications can move through the pipeline.",
        );
      if (d.version !== a.version)
        throw new HttpError(
          409,
          "This application changed. Refresh before moving it.",
        );
      const stages = (
        await c.query(
          "select name from morrow.pipeline_stages where org_id=$1 order by position",
          [ctx.orgId],
        )
      ).rows.map((r) => r.name);
      if (!stageAllowed(a.stage, d.stage, stages))
        throw new HttpError(
          422,
          "Move one stage at a time. Hires require an accepted offer.",
        );
      await c.query(
        "update morrow.applications set stage=$1,stage_entered_at=now(),updated_at=now(),version=version+1 where id=$2",
        [d.stage, id],
      );
      await c.query(
        "insert into morrow.application_stage_history(org_id,application_id,from_stage,to_stage,actor_id) values($1,$2,$3,$4,$5)",
        [ctx.orgId, id, a.stage, d.stage, ctx.user.id],
      );
      await audit(
        c,
        ctx,
        "application",
        id,
        "Stage changed",
        { from: a.stage, to: d.stage },
        true,
      );
      return { ok: true };
    }
    if (path[1] === "status") {
      const d = z
        .object({
          status: z.enum(["rejected", "hold", "active"]),
          reason: z.string().trim().min(5).max(2000),
          version: z.number().int(),
        })
        .parse(input);
      if (d.version !== a.version)
        throw new HttpError(409, "This application changed. Refresh first.");
      if (
        a.status === "hired" ||
        a.status === "withdrawn" ||
        a.status === "rejected" ||
        (d.status === "active" && a.status !== "hold")
      )
        throw new HttpError(422, "This application cannot change status.");
      await c.query(
        "update morrow.applications set status=$1,reason=$2,updated_at=now(),version=version+1 where id=$3",
        [d.status, d.reason, id],
      );
      if (d.status === "rejected") {
        await c.query(
          "update morrow.interviews set status='cancelled' where application_id=$1 and status='scheduled'",
          [id],
        );
        await c.query(
          "update morrow.offers set status='expired',version=version+1 where application_id=$1 and status in ('draft','pending','approved','available')",
          [id],
        );
      }
      await audit(
        c,
        ctx,
        "application",
        id,
        `Application ${d.status}`,
        {},
        true,
      );
      return { ok: true };
    }
    if (path[1] === "note") {
      const d = z
        .object({ body: z.string().trim().min(2).max(10000) })
        .parse(input);
      const n = (
        await c.query(
          "insert into morrow.notes(org_id,application_id,author_id,body) values($1,$2,$3,$4) returning id",
          [ctx.orgId, id, ctx.user.id, d.body],
        )
      ).rows[0];
      await audit(c, ctx, "application", id, "Note added", { note_id: n.id });
      return n;
    }
    if (path[1] === "owner") {
      const d = z.object({ userId: z.uuid() }).parse(input);
      if (
        !(
          await c.query(
            "select 1 from morrow.memberships where org_id=$1 and user_id=$2 and role in ('admin','recruiter')",
            [ctx.orgId, d.userId],
          )
        ).rows[0]
      )
        throw new HttpError(422, "Choose an organization recruiter.");
      await c.query(
        "update morrow.applications set owner_id=$1,version=version+1,updated_at=now() where id=$2",
        [d.userId, id],
      );
      await audit(c, ctx, "application", id, "Owner assigned", {
        owner: d.userId,
      });
      return { ok: true };
    }
    if (path[1] === "talent") {
      const d = z
        .object({ tags: z.array(z.string().trim().min(1).max(30)).max(10) })
        .parse(input);
      const candidate = (
        await c.query(
          "select talent_consent from morrow.candidates where id=$1",
          [a.candidate_id],
        )
      ).rows[0];
      if (!candidate.talent_consent)
        throw new HttpError(
          422,
          "The candidate has not consented to talent-pool retention.",
        );
      await c.query("update morrow.candidates set tags=$1 where id=$2", [
        d.tags,
        a.candidate_id,
      ]);
      await audit(c, ctx, "application", id, "Talent tags updated");
      return { ok: true };
    }
    throw new HttpError(404, "Action not found.");
  });
}
