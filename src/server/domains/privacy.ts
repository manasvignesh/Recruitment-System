import { z } from "zod";
import { pool, transaction } from "../db";
import { allow, HttpError, type Context } from "../security";
import { audit } from "../audit";
export async function privacy(ctx: Context, req: Request, path: string[]) {
  allow(ctx, ["admin"]);
  if (req.method === "GET")
    return (
      await pool.query(
        "select p.*,c.name,c.email from morrow.privacy_requests p join morrow.candidates c on c.id=p.candidate_id where p.org_id=$1 order by p.created_at desc",
        [ctx.orgId],
      )
    ).rows;
  const id = z.uuid().parse(path[0]);
  const d = z
    .object({
      erase: z.boolean(),
      resolution: z.string().trim().min(10).max(2000),
    })
    .parse(await req.json());
  return transaction(async (c) => {
    const r = (
      await c.query(
        "select * from morrow.privacy_requests where org_id=$1 and id=$2 for update",
        [ctx.orgId, id],
      )
    ).rows[0];
    if (!r || r.status !== "open")
      throw new HttpError(409, "This request is no longer open.");
    if (d.erase) {
      await c.query("select id from morrow.candidates where id=$1 for update", [
        r.candidate_id,
      ]);
      if (r.kind !== "erasure")
        throw new HttpError(
          422,
          "Only an erasure request can erase a profile.",
        );
      const hired = (
        await c.query(
          "select id from morrow.applications where candidate_id=$1 and status='hired'",
          [r.candidate_id],
        )
      ).rows[0];
      if (hired)
        throw new HttpError(
          409,
          "This profile includes a completed hire. Review employment retention obligations separately; automated erasure is disabled.",
        );
      await c.query(
        "delete from morrow.documents where org_id=$1 and candidate_id=$2",
        [ctx.orgId, r.candidate_id],
      );
      await c.query(
        "delete from morrow.talent_pool_memberships where org_id=$1 and candidate_id=$2",
        [ctx.orgId, r.candidate_id],
      );
      await c.query(
        "update morrow.candidates set name='Redacted candidate',email=id::text || '@redacted.invalid',phone='',skills='{}',experience='',availability='',talent_consent=false,tags='{}' where org_id=$1 and id=$2",
        [ctx.orgId, r.candidate_id],
      );
      await c.query(
        "update morrow.applications set answers='{}',reason=null,status=case when status in ('active','hold') then 'withdrawn' else status end,updated_at=now(),version=version+1 where candidate_id=$1",
        [r.candidate_id],
      );
      await c.query(
        "update morrow.notes set body='[Removed following approved erasure]' where application_id in (select id from morrow.applications where candidate_id=$1)",
        [r.candidate_id],
      );
      await c.query(
        "update morrow.messages set body='[Removed following approved erasure]' where application_id in (select id from morrow.applications where candidate_id=$1)",
        [r.candidate_id],
      );
      await c.query(
        "update morrow.interviews set status='cancelled',instructions='' where application_id in (select id from morrow.applications where candidate_id=$1) and status='scheduled'",
        [r.candidate_id],
      );
      await c.query(
        "update morrow.scorecards set body='[Removed following approved erasure]' where interview_id in(select i.id from morrow.interviews i join morrow.applications a on a.id=i.application_id where a.candidate_id=$1)",
        [r.candidate_id],
      );
      await c.query(
        "update morrow.hiring_decisions set evidence='[Removed following approved erasure]' where application_id in(select id from morrow.applications where candidate_id=$1)",
        [r.candidate_id],
      );
      await c.query(
        "update morrow.offers set terms='[Removed following approved erasure]',status=case when status in ('draft','pending','approved','available') then 'expired' else status end,version=version+1 where application_id in(select id from morrow.applications where candidate_id=$1)",
        [r.candidate_id],
      );
      await c.query(
        "update morrow.offer_versions set snapshot=jsonb_set(snapshot,'{terms}','\"[Removed following approved erasure]\"'::jsonb) where offer_id in(select o.id from morrow.offers o join morrow.applications a on a.id=o.application_id where a.candidate_id=$1)",
        [r.candidate_id],
      );
    }
    await c.query(
      "update morrow.privacy_requests set status='resolved',body=$1 where id=$2",
      [d.resolution, id],
    );
    await audit(
      c,
      ctx,
      "privacy_request",
      id,
      d.erase
        ? "Candidate recruitment profile redacted"
        : "Privacy request resolved",
      { resolution: d.resolution },
    );
    return { ok: true };
  });
}
