import { z } from "zod";
import { pool, transaction } from "../db";
import { allow, appAccess, HttpError, type Context } from "../security";
import { audit } from "../audit";
import { canTransition, offerTransitions } from "../rules";
export async function offers(ctx: Context, req: Request, path: string[]) {
  const input = await req.json();
  const id = path[0];
  if (!id) {
    allow(ctx, ["admin", "recruiter"]);
    const d = z
      .object({
        application_id: z.uuid(),
        compensation: z.number().int().positive(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        start_date: z.iso.date(),
        expires_at: z.iso.datetime({ offset: true }),
        terms: z.string().min(20).max(10000),
      })
      .parse(input);
    const a = await appAccess(ctx, d.application_id);
    if (a.stage !== "Offer" || a.status !== "active")
      throw new HttpError(422, "Advance the active candidate to Offer first.");
    if (new Date(d.expires_at) <= new Date())
      throw new HttpError(422, "The expiry must be in the future.");
    return transaction(async (c) => {
      const current = (
        await c.query(
          "select status,stage from morrow.applications where id=$1 for update",
          [a.id],
        )
      ).rows[0];
      if (current.status !== "active" || current.stage !== "Offer")
        throw new HttpError(
          409,
          "The application is no longer ready for an offer.",
        );
      const o = (
        await c.query(
          "insert into morrow.offers(org_id,application_id,compensation,currency,start_date,expires_at,terms,created_by) values($1,$2,$3,$4,$5,$6,$7,$8) returning *",
          [
            ctx.orgId,
            d.application_id,
            d.compensation,
            d.currency,
            d.start_date,
            d.expires_at,
            d.terms,
            ctx.user.id,
          ],
        )
      ).rows[0];
      await audit(c, ctx, "application", a.id, "Offer prepared", {
        offer: o.id,
      });
      return o;
    });
  }
  z.uuid().parse(id);
  const offer = (
    await pool.query("select * from morrow.offers where org_id=$1 and id=$2", [
      ctx.orgId,
      id,
    ])
  ).rows[0];
  if (!offer) throw new HttpError(404, "Offer not found.");
  const a = await appAccess(ctx, offer.application_id);
  if (path[1] === "edit") {
    allow(ctx, ["admin", "recruiter"]);
    const d = z
      .object({
        compensation: z.number().int().positive(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        start_date: z.iso.date(),
        expires_at: z.iso.datetime({ offset: true }),
        terms: z.string().min(20).max(10000),
        version: z.number().int(),
      })
      .parse(input);
    if (new Date(d.expires_at) <= new Date())
      throw new HttpError(422, "Choose a future expiry.");
    return transaction(async (c) => {
      const current = (
        await c.query(
          "select status from morrow.applications where id=$1 for update",
          [a.id],
        )
      ).rows[0];
      const o = (
        await c.query("select * from morrow.offers where id=$1 for update", [
          id,
        ])
      ).rows[0];
      if (
        current.status !== "active" ||
        o.status !== "draft" ||
        o.version !== d.version
      )
        throw new HttpError(
          409,
          "Only the current draft for an active application can be edited.",
        );
      const edited = (
        await c.query(
          "update morrow.offers set compensation=$1,currency=$2,start_date=$3,expires_at=$4,terms=$5,approved_by=null,version=version+1,updated_at=now() where id=$6 returning *",
          [d.compensation, d.currency, d.start_date, d.expires_at, d.terms, id],
        )
      ).rows[0];
      await audit(c, ctx, "application", a.id, "Offer revised", {
        offer: id,
        version: edited.version,
      });
      return edited;
    });
  }
  if (path[1] === "hire") {
    allow(ctx, ["admin", "recruiter"]);
    return transaction(async (c) => {
      const job = (
        await c.query("select * from morrow.jobs where id=$1 for update", [
          a.job_id,
        ])
      ).rows[0];
      const current = (
        await c.query(
          "select * from morrow.applications where id=$1 for update",
          [a.id],
        )
      ).rows[0];
      const o = (
        await c.query("select * from morrow.offers where id=$1 for update", [
          id,
        ])
      ).rows[0];
      if (o.status !== "accepted")
        throw new HttpError(
          422,
          "An accepted offer is required to complete a hire.",
        );
      if (current.status !== "active")
        throw new HttpError(409, "This application is no longer active.");
      if (!["published", "approved"].includes(job.status))
        throw new HttpError(
          409,
          "Reopen the position before completing the hire.",
        );
      const hired = Number(
        (
          await c.query(
            "select count(*) from morrow.applications where job_id=$1 and status='hired'",
            [a.job_id],
          )
        ).rows[0].count,
      );
      if (hired >= job.openings)
        throw new HttpError(409, "All openings have already been filled.");
      await c.query(
        "update morrow.applications set status='hired',stage='Hired',hired_at=now(),stage_entered_at=now(),updated_at=now(),version=version+1 where id=$1",
        [a.id],
      );
      await c.query(
        "insert into morrow.application_stage_history(org_id,application_id,from_stage,to_stage,actor_id) values($1,$2,$3,'Hired',$4)",
        [ctx.orgId, a.id, current.stage, ctx.user.id],
      );
      if (hired + 1 >= job.openings)
        await c.query(
          "update morrow.jobs set status='closed',version=version+1,updated_at=now() where id=$1",
          [a.job_id],
        );
      await audit(c, ctx, "application", a.id, "Hire completed", {}, true);
      return { ok: true };
    });
  }
  const d = z
    .object({ status: z.string(), version: z.number().int() })
    .parse(input);
  return transaction(async (c) => {
    const current = (
      await c.query(
        "select status from morrow.applications where id=$1 for update",
        [a.id],
      )
    ).rows[0];
    if (current.status !== "active" && d.status !== "expired")
      throw new HttpError(409, "The application is no longer active.");
    const o = (
      await c.query("select * from morrow.offers where id=$1 for update", [id])
    ).rows[0];
    if (o.version !== d.version)
      throw new HttpError(409, "This offer changed. Refresh first.");
    if (
      !canTransition(offerTransitions, o.status, d.status) ||
      ["accepted", "declined"].includes(d.status)
    )
      throw new HttpError(422, "Offer transition is not allowed.");
    if (d.status === "approved") {
      allow(ctx, ["admin", "manager"]);
      if (ctx.role === "manager" && a.manager_id !== ctx.user.id)
        throw new HttpError(
          403,
          "Only the assigned hiring manager can approve.",
        );
    } else allow(ctx, ["admin", "recruiter"]);
    if (new Date(o.expires_at) < new Date() && d.status !== "expired")
      throw new HttpError(422, "The offer has expired.");
    await c.query(
      "update morrow.offers set status=$1,approved_by=case when $1='approved' then $2 else approved_by end,version=version+1,updated_at=now() where id=$3",
      [d.status, ctx.user.id, id],
    );
    await audit(
      c,
      ctx,
      "application",
      a.id,
      `Offer ${d.status}`,
      { offer: id },
      d.status === "available" || d.status === "expired",
    );
    return { ok: true };
  });
}
