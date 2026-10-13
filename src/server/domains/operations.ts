import { z } from "zod";
import { pool, transaction } from "../db";
import { allow, appAccess, HttpError, type Context } from "../security";
import { audit } from "../audit";
export async function operations(ctx: Context, req: Request, path: string[]) {
  const domain = path[0];
  if (domain === "message-templates") {
    allow(ctx, ["admin", "recruiter"]);
    if (req.method === "GET")
      return (
        await pool.query(
          "select * from morrow.message_templates where org_id=$1 order by name",
          [ctx.orgId],
        )
      ).rows;
    const d = z
      .object({
        name: z.string().trim().min(3).max(100),
        body: z.string().trim().min(10).max(10000),
      })
      .parse(await req.json());
    return transaction(async (c) => {
      const r = (
        await c.query(
          "insert into morrow.message_templates(org_id,name,body) values($1,$2,$3) returning *",
          [ctx.orgId, d.name, d.body],
        )
      ).rows[0];
      await audit(c, ctx, "message_template", r.id, "Message template created");
      return r;
    });
  }
  if (domain === "documents") {
    allow(ctx, ["admin", "recruiter"]);
    const id = z.uuid().parse(path[1]);
    const d = z
      .object({ text: z.string().max(100000) })
      .parse(await req.json());
    return transaction(async (c) => {
      const result = await c.query(
        "update morrow.documents set extracted_text=$1,parsing_status='parsed' where id=$2 and org_id=$3 returning id",
        [d.text, id, ctx.orgId],
      );
      if (!result.rows[0]) throw new HttpError(404, "Document not found.");
      await audit(c, ctx, "document", id, "Extracted document text corrected");
      return { ok: true };
    });
  }
  if (domain === "reference") {
    const [departments, members, stages, templates] = await Promise.all([
      pool.query(
        "select id,name from morrow.departments where org_id=$1 order by name",
        [ctx.orgId],
      ),
      pool.query(
        "select u.id,u.name,m.role from morrow.users u join morrow.memberships m on m.user_id=u.id where m.org_id=$1 order by u.name",
        [ctx.orgId],
      ),
      pool.query(
        "select name,position from morrow.pipeline_stages where org_id=$1 order by position",
        [ctx.orgId],
      ),
      pool.query(
        "select id,name,criteria from morrow.scorecard_templates where org_id=$1 order by name",
        [ctx.orgId],
      ),
    ]);
    return {
      user: ctx.user,
      role: ctx.role,
      departments: departments.rows,
      members: members.rows,
      stages: stages.rows,
      templates: templates.rows,
    };
  }
  if (domain === "templates") {
    allow(ctx, ["admin", "recruiter"]);
    const d = z
      .object({
        name: z.string().trim().min(3).max(100),
        criteria: z.array(z.string().trim().min(3).max(100)).min(2).max(10),
      })
      .parse(await req.json());
    if (new Set(d.criteria).size !== d.criteria.length)
      throw new HttpError(422, "Competency names must be unique.");
    return transaction(async (c) => {
      const r = (
        await c.query(
          "insert into morrow.scorecard_templates(org_id,name,criteria) values($1,$2,$3) returning *",
          [ctx.orgId, d.name, JSON.stringify(d.criteria)],
        )
      ).rows[0];
      await audit(
        c,
        ctx,
        "scorecard_template",
        r.id,
        "Scorecard template created",
      );
      return r;
    });
  }
  if (domain === "audit") {
    allow(ctx, ["admin"]);
    return (
      await pool.query(
        "select e.id,e.action,e.entity_type,e.entity_id,e.detail,e.created_at,u.name as actor from morrow.audit_events e join morrow.users u on u.id=e.actor_id where e.org_id=$1 order by e.created_at desc limit 100",
        [ctx.orgId],
      )
    ).rows;
  }
  if (domain === "talent") {
    allow(ctx, ["admin", "recruiter"]);
    return (
      await pool.query(
        "select c.id,c.name,c.email,c.skills,c.tags,c.experience,array(select pm.pool_id from morrow.talent_pool_memberships pm where pm.candidate_id=c.id) as pool_ids,(select count(*)::int from morrow.candidates d where d.org_id=c.org_id and d.id<>c.id and d.talent_consent=true and lower(trim(d.name))=lower(trim(c.name))) as possible_duplicates,count(a.id)::int as applications,max(a.created_at) as last_applied from morrow.candidates c left join morrow.applications a on a.candidate_id=c.id where c.org_id=$1 and c.talent_consent=true group by c.id order by c.name limit 100",
        [ctx.orgId],
      )
    ).rows;
  }
  if (domain === "tasks") {
    if (req.method === "GET")
      return (
        await pool.query(
          "select t.*,u.name as assignee,c.name as candidate from morrow.tasks t join morrow.users u on u.id=t.assignee_id left join morrow.applications a on a.id=t.application_id left join morrow.candidates c on c.id=a.candidate_id where t.org_id=$1 and ($2 in ('admin','recruiter') or t.assignee_id=$3) order by t.status desc,t.due_at limit 100",
          [ctx.orgId, ctx.role, ctx.user.id],
        )
      ).rows;
    const input = await req.json();
    if (path[1]) {
      const d = z.object({ status: z.enum(["open", "done"]) }).parse(input);
      return transaction(async (c) => {
        const r = await c.query(
          "update morrow.tasks set status=$1 where id=$2 and org_id=$3 and ($4 in ('admin','recruiter') or assignee_id=$5) returning *",
          [d.status, z.uuid().parse(path[1]), ctx.orgId, ctx.role, ctx.user.id],
        );
        if (!r.rows[0]) throw new HttpError(404, "Task not found.");
        await audit(
          c,
          ctx,
          "task",
          path[1],
          d.status === "done" ? "Task completed" : "Task reopened",
        );
        return r.rows[0];
      });
    }
    allow(ctx, ["admin", "recruiter"]);
    const d = z
      .object({
        title: z.string().trim().min(3).max(200),
        application_id: z.uuid().nullable(),
        assignee_id: z.uuid(),
        due_at: z.iso.datetime({ offset: true }),
      })
      .parse(input);
    if (d.application_id) await appAccess(ctx, d.application_id);
    return transaction(async (c) => {
      if (
        !(
          await c.query(
            "select 1 from morrow.memberships where org_id=$1 and user_id=$2",
            [ctx.orgId, d.assignee_id],
          )
        ).rows[0]
      )
        throw new HttpError(422, "Assignee is not in this organization.");
      const t = (
        await c.query(
          "insert into morrow.tasks(org_id,title,application_id,assignee_id,due_at) values($1,$2,$3,$4,$5) returning *",
          [ctx.orgId, d.title, d.application_id, d.assignee_id, d.due_at],
        )
      ).rows[0];
      await audit(c, ctx, "task", t.id, "Task created");
      return t;
    });
  }
  if (domain === "messages") {
    allow(ctx, ["admin", "recruiter"]);
    if (path[1] && req.method === "POST") {
      const id = z.uuid().parse(path[1]);
      const d = z
        .object({
          body: z.string().trim().min(2).max(10000),
          state: z.enum(["draft", "portal", "pending_email"]),
        })
        .parse(await req.json());
      return transaction(async (c) => {
        const original = (
          await c.query(
            "select * from morrow.messages where org_id=$1 and id=$2 for update",
            [ctx.orgId, id],
          )
        ).rows[0];
        if (!original || original.author_id !== ctx.user.id)
          throw new HttpError(404, "Draft not found.");
        if (original.state !== "draft")
          throw new HttpError(409, "Only your unsent drafts can be edited.");
        const r = (
          await c.query(
            "update morrow.messages set body=$1,state=$2 where id=$3 returning *",
            [d.body, d.state, id],
          )
        ).rows[0];
        await audit(
          c,
          ctx,
          "application",
          original.application_id,
          d.state === "portal"
            ? "Portal message sent"
            : "Message draft updated",
          { message: id },
          d.state === "portal",
        );
        return r;
      });
    }
    if (req.method === "GET")
      return (
        await pool.query(
          "select m.*,c.name as candidate,j.title as job_title,u.name as author from morrow.messages m join morrow.applications a on a.id=m.application_id join morrow.candidates c on c.id=a.candidate_id join morrow.jobs j on j.id=a.job_id join morrow.users u on u.id=m.author_id where m.org_id=$1 order by created_at desc limit 100",
          [ctx.orgId],
        )
      ).rows;
    const d = z
      .object({
        application_id: z.uuid(),
        body: z.string().trim().min(2).max(10000),
        state: z.enum(["draft", "portal", "pending_email"]),
      })
      .parse(await req.json());
    await appAccess(ctx, d.application_id);
    return transaction(async (c) => {
      const m = (
        await c.query(
          "insert into morrow.messages(org_id,application_id,author_id,body,state) values($1,$2,$3,$4,$5) returning *",
          [ctx.orgId, d.application_id, ctx.user.id, d.body, d.state],
        )
      ).rows[0];
      await audit(
        c,
        ctx,
        "application",
        d.application_id,
        d.state === "portal"
          ? "Portal message sent"
          : d.state === "draft"
            ? "Message draft saved"
            : "Email queued without delivery",
        { message: m.id },
        d.state === "portal",
      );
      return m;
    });
  }
  if (domain === "search") {
    const q = z
      .string()
      .max(100)
      .parse(new URL(req.url).searchParams.get("q") || "");
    if (q.trim().length < 2) return [];
    const r = await pool.query(
      `select 'job' as type,j.id,j.title as label,j.status as detail from morrow.jobs j where j.org_id=$1 and ($2 in ('admin','recruiter') or j.manager_id=$3 or exists(select 1 from morrow.interviews i join morrow.applications a on a.id=i.application_id where a.job_id=j.id and i.interviewer_id=$3)) and to_tsvector('simple',j.title || ' ' || j.description) @@ plainto_tsquery('simple',$4) union all select 'application',a.id,c.name,j.title from morrow.applications a join morrow.candidates c on c.id=a.candidate_id join morrow.jobs j on j.id=a.job_id where a.org_id=$1 and ($2 in ('admin','recruiter') or ($2='manager' and j.manager_id=$3) or exists(select 1 from morrow.interviews i where i.application_id=a.id and i.interviewer_id=$3)) and (to_tsvector('simple',c.name || ' ' || c.email || ' ' || c.experience) @@ plainto_tsquery('simple',$4) or c.name ilike '%' || $4 || '%') union all select 'department',d.id,d.name,'Department' from morrow.departments d where d.org_id=$1 and d.name ilike '%' || $4 || '%' union all select 'note',a.id,c.name,'Private note: ' || left(n.body,80) from morrow.notes n join morrow.applications a on a.id=n.application_id join morrow.jobs j on j.id=a.job_id join morrow.candidates c on c.id=a.candidate_id where n.org_id=$1 and ($2 in ('admin','recruiter') or ($2='manager' and j.manager_id=$3)) and to_tsvector('simple',n.body) @@ plainto_tsquery('simple',$4) limit 15`,
      [ctx.orgId, ctx.role, ctx.user.id, q],
    );
    return r.rows;
  }
  throw new HttpError(404, "Route not found.");
}
export function ics(interview: {
  id: string;
  title: string;
  starts_at: string;
  duration: number;
  location: string;
}) {
  const date = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const escape = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/[\r\n]+/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Morrow//Interviews//EN",
    "BEGIN:VEVENT",
    `UID:${interview.id}@morrow`,
    `DTSTAMP:${date(new Date())}`,
    `DTSTART:${date(new Date(interview.starts_at))}`,
    `DTEND:${date(new Date(new Date(interview.starts_at).getTime() + interview.duration * 60000))}`,
    `SUMMARY:${escape(interview.title)}`,
    `LOCATION:${escape(interview.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
