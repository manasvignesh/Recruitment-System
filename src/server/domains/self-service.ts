import { z } from "zod";
import { pool, transaction } from "../db";
import { identity, HttpError, verifyOrigin } from "../security";
import { boundedForm, processUpload } from "./files";
import { attachmentStorage } from "../storage";
import { ics } from "./operations";
export async function selfService(
  req: Request,
  path: string[],
): Promise<Response> {
  const user = await identity();
  const action = path[0];
  if (action === "profile" && req.method === "GET")
    return Response.json(
      {
        user,
        profiles: (
          await pool.query(
            "select c.id,c.name,c.phone,c.skills,c.experience,c.talent_consent,c.availability,o.name as organization from morrow.candidates c join morrow.organizations o on o.id=c.org_id where c.user_id=$1",
            [user.id],
          )
        ).rows,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  if (action === "export" && req.method === "GET") {
    const profiles = (
      await pool.query(
        "select id,org_id,name,email,phone,skills,experience,talent_consent,availability from morrow.candidates where user_id=$1",
        [user.id],
      )
    ).rows;
    const ids = profiles.map((c) => c.id);
    const applications = (
      await pool.query(
        "select id,job_id,stage,status,answers,created_at from morrow.applications where candidate_id=any($1::uuid[])",
        [ids],
      )
    ).rows;
    return new Response(
      JSON.stringify(
        {
          account: { name: user.name, email: user.email },
          profiles,
          applications,
        },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=morrow-my-data.json",
          "Cache-Control": "private, no-store",
        },
      },
    );
  }
  if (action === "calendar" && req.method === "GET") {
    const i = (
      await pool.query(
        "select i.* from morrow.interviews i join morrow.applications a on a.id=i.application_id join morrow.candidates c on c.id=a.candidate_id where i.id=$1 and c.user_id=$2",
        [z.uuid().parse(path[1]), user.id],
      )
    ).rows[0];
    if (!i) throw new HttpError(404, "Interview not found.");
    return new Response(ics(i), {
      headers: {
        "Content-Type": "text/calendar",
        "Content-Disposition": "attachment; filename=interview.ics",
      },
    });
  }
  verifyOrigin(req);
  if (action === "document") {
    const app = (
      await pool.query(
        "select a.* from morrow.applications a join morrow.candidates c on c.id=a.candidate_id where a.id=$1 and c.user_id=$2",
        [z.uuid().parse(path[1]), user.id],
      )
    ).rows[0];
    if (!app) throw new HttpError(404, "Application not found.");
    const f = await boundedForm(req);
    const file = f.get("resume");
    if (!(file instanceof File)) throw new HttpError(422, "Choose a resume.");
    const upload = await processUpload(file);
    const id = await transaction(async (c) => {
      await c.query("select id from morrow.candidates where id=$1 for update", [
        app.candidate_id,
      ]);
      const count = Number(
        (
          await c.query(
            "select count(*) from morrow.documents where candidate_id=$1",
            [app.candidate_id],
          )
        ).rows[0].count,
      );
      if (count >= 5)
        throw new HttpError(
          422,
          "A maximum of five documents can be retained. Contact the hiring team to replace older documents.",
        );
      const id = await attachmentStorage.put(
        c,
        app.org_id,
        app.candidate_id,
        upload,
      );
      await c.query(
        "insert into morrow.audit_events(org_id,actor_id,entity_type,entity_id,action,public) values($1,$2,'application',$3,'Document added',true)",
        [app.org_id, user.id, app.id],
      );
      return id;
    });
    return Response.json({ id });
  }
  const input = await req.json();
  const candidate = (
    await pool.query(
      "select * from morrow.candidates where id=$1 and user_id=$2",
      [z.uuid().parse(input.candidate_id), user.id],
    )
  ).rows[0];
  if (!candidate) throw new HttpError(404, "Profile not found.");
  if (action === "privacy") {
    const d = z
      .object({
        kind: z.enum(["erasure", "correction"]),
        body: z.string().trim().min(10).max(4000),
      })
      .parse(input);
    return Response.json(
      await transaction(async (c) => {
        const r = (
          await c.query(
            "insert into morrow.privacy_requests(org_id,candidate_id,kind,body) values($1,$2,$3,$4) returning id",
            [candidate.org_id, candidate.id, d.kind, d.body],
          )
        ).rows[0];
        const admin = (
          await c.query(
            "select user_id from morrow.memberships where org_id=$1 and role='admin' order by created_at limit 1",
            [candidate.org_id],
          )
        ).rows[0];
        if (admin)
          await c.query(
            "insert into morrow.tasks(org_id,assignee_id,title,due_at) values($1,$2,$3,now()+interval '7 days')",
            [candidate.org_id, admin.user_id, "Review privacy request " + r.id],
          );
        return {
          id: r.id,
          message: "Your request is recorded for an administrator to review.",
        };
      }),
    );
  }
  if (action === "profile") {
    const d = z
      .object({
        name: z.string().trim().min(2).max(150),
        phone: z.string().max(50),
        experience: z.string().max(10000),
        skills: z.array(z.string().max(100)).max(30),
        availability: z.string().max(2000),
        talent_consent: z.boolean(),
      })
      .parse(input);
    await transaction(async (c) => {
      await c.query("select id from morrow.candidates where id=$1 for update", [
        candidate.id,
      ]);
      await c.query(
        "update morrow.candidates set name=$1,phone=$2,experience=$3,skills=$4,availability=$5,talent_consent=$6 where id=$7",
        [
          d.name,
          d.phone,
          d.experience,
          d.skills,
          d.availability,
          d.talent_consent,
          candidate.id,
        ],
      );
      if (!d.talent_consent)
        await c.query(
          "delete from morrow.talent_pool_memberships where org_id=$1 and candidate_id=$2",
          [candidate.org_id, candidate.id],
        );
      await c.query(
        "insert into morrow.audit_events(org_id,actor_id,entity_type,entity_id,action) values($1,$2,'candidate',$3,'Candidate profile updated')",
        [candidate.org_id, user.id, candidate.id],
      );
    });
    return Response.json({ ok: true });
  }
  throw new HttpError(404, "Action not found.");
}
