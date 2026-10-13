import { z } from "zod";
import { transaction } from "../db";
import { allow, appAccess, HttpError, type Context } from "../security";
import { audit } from "../audit";
export async function bulk(ctx: Context, req: Request) {
  allow(ctx, ["admin", "recruiter"]);
  const d = z
    .object({
      applications: z
        .array(z.object({ id: z.uuid(), version: z.number().int() }))
        .min(1)
        .max(50),
      action: z.enum(["assign", "reject", "draft_message"]),
      owner_id: z.uuid().optional(),
      body: z.string().trim().min(5).max(10000).optional(),
    })
    .parse(await req.json());
  if (new Set(d.applications.map((a) => a.id)).size !== d.applications.length)
    throw new HttpError(422, "Choose each application once.");
  for (const a of d.applications) await appAccess(ctx, a.id);
  return transaction(async (c) => {
    const ids = d.applications.map((a) => a.id).sort();
    const records = (
      await c.query(
        "select * from morrow.applications where org_id=$1 and id=any($2::uuid[]) order by id for update",
        [ctx.orgId, ids],
      )
    ).rows;
    if (
      records.length !== ids.length ||
      records.some(
        (a) => d.applications.find((i) => i.id === a.id)?.version !== a.version,
      )
    )
      throw new HttpError(
        409,
        "A selected application changed. Refresh your selection before continuing.",
      );
    if (d.action === "assign") {
      if (
        !d.owner_id ||
        !(
          await c.query(
            "select 1 from morrow.memberships where org_id=$1 and user_id=$2 and role in ('admin','recruiter')",
            [ctx.orgId, d.owner_id],
          )
        ).rows[0]
      )
        throw new HttpError(422, "Choose a recruiter in this organization.");
      await c.query(
        "update morrow.applications set owner_id=$1,version=version+1,updated_at=now() where id=any($2::uuid[])",
        [d.owner_id, ids],
      );
    } else if (d.action === "reject") {
      if (!d.body)
        throw new HttpError(422, "An internal rejection reason is required.");
      if (records.some((a) => !["active", "hold"].includes(a.status)))
        throw new HttpError(
          409,
          "Only active or on-hold applications can be rejected.",
        );
      await c.query(
        "update morrow.applications set status='rejected',reason=$1,version=version+1,updated_at=now() where id=any($2::uuid[])",
        [d.body, ids],
      );
      await c.query(
        "update morrow.interviews set status='cancelled' where application_id=any($1::uuid[]) and status='scheduled'",
        [ids],
      );
      await c.query(
        "update morrow.offers set status='expired',version=version+1 where application_id=any($1::uuid[]) and status in ('draft','pending','approved','available')",
        [ids],
      );
    } else {
      if (!d.body) throw new HttpError(422, "Write the draft message first.");
      for (const a of records)
        await c.query(
          "insert into morrow.messages(org_id,application_id,author_id,body,state) values($1,$2,$3,$4,'draft')",
          [ctx.orgId, a.id, ctx.user.id, d.body],
        );
    }
    for (const a of records)
      await audit(
        c,
        ctx,
        "application",
        a.id,
        d.action === "assign"
          ? "Owner assigned"
          : d.action === "reject"
            ? "Application rejected"
            : "Bulk message draft prepared",
        { bulk: true },
        d.action === "reject",
      );
    return { count: ids.length };
  });
}
