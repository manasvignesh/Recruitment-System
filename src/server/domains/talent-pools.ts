import { z } from "zod";
import { pool, transaction } from "../db";
import { allow, HttpError, type Context } from "../security";
import { audit } from "../audit";
export async function talentPools(ctx: Context, req: Request, path: string[]) {
  allow(ctx, ["admin", "recruiter"]);
  if (req.method === "GET")
    return (
      await pool.query(
        "select p.*,count(c.id)::int as people from morrow.talent_pools p left join morrow.talent_pool_memberships m on m.pool_id=p.id left join morrow.candidates c on c.id=m.candidate_id and c.talent_consent=true where p.org_id=$1 group by p.id order by p.name",
        [ctx.orgId],
      )
    ).rows;
  const input = await req.json();
  if (!path[0]) {
    const d = z
      .object({
        name: z.string().trim().min(2).max(100),
        description: z.string().max(4000).default(""),
      })
      .parse(input);
    return transaction(async (c) => {
      const r = (
        await c.query(
          "insert into morrow.talent_pools(org_id,name,description) values($1,$2,$3) returning *",
          [ctx.orgId, d.name, d.description],
        )
      ).rows[0];
      await audit(c, ctx, "talent_pool", r.id, "Talent pool created");
      return r;
    });
  }
  const id = z.uuid().parse(path[0]);
  const d = z
    .object({ candidate_id: z.uuid(), action: z.enum(["add", "remove"]) })
    .parse(input);
  return transaction(async (c) => {
    const p = (
      await c.query(
        "select * from morrow.talent_pools where org_id=$1 and id=$2",
        [ctx.orgId, id],
      )
    ).rows[0];
    const candidate = (
      await c.query(
        "select * from morrow.candidates where org_id=$1 and id=$2 for update",
        [ctx.orgId, d.candidate_id],
      )
    ).rows[0];
    if (!p || !candidate)
      throw new HttpError(404, "Pool or candidate not found.");
    if (d.action === "add") {
      if (!candidate.talent_consent)
        throw new HttpError(
          422,
          "Candidate consent is required for talent pool membership.",
        );
      await c.query(
        "insert into morrow.talent_pool_memberships(org_id,pool_id,candidate_id) values($1,$2,$3) on conflict do nothing",
        [ctx.orgId, id, d.candidate_id],
      );
    } else
      await c.query(
        "delete from morrow.talent_pool_memberships where org_id=$1 and pool_id=$2 and candidate_id=$3",
        [ctx.orgId, id, d.candidate_id],
      );
    await audit(
      c,
      ctx,
      "candidate",
      candidate.id,
      d.action === "add" ? "Added to talent pool" : "Removed from talent pool",
      { pool: id },
    );
    return { ok: true };
  });
}
