import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { pool, transaction } from "../db";
import { allow, HttpError, identity, type Context } from "../security";
import { audit } from "../audit";
import { defaultStages } from "../rules";
export async function organizations(req: Request, path: string[]) {
  const user = await identity();
  if (req.method === "GET") {
    const r = await pool.query(
      "select o.*,m.role from morrow.organizations o join morrow.memberships m on m.org_id=o.id where m.user_id=$1 order by o.created_at",
      [user.id],
    );
    return r.rows;
  }
  const input = await req.json();
  if (path[0] === "join") {
    const { token } = z.object({ token: z.string().min(32) }).parse(input);
    return transaction(async (c) => {
      const r = await c.query(
        "select * from morrow.invitations where token_hash=$1 and accepted_at is null and expires_at>now() for update",
        [createHash("sha256").update(token).digest("hex")],
      );
      const i = r.rows[0];
      if (!i || i.email.toLowerCase() !== user.email.toLowerCase())
        throw new HttpError(
          403,
          "Invitation is invalid, expired, or addressed to another email.",
        );
      await c.query(
        "insert into morrow.memberships(org_id,user_id,role) values($1,$2,$3) on conflict do nothing",
        [i.org_id, user.id, i.role],
      );
      await c.query(
        "update morrow.invitations set accepted_at=now() where id=$1",
        [i.id],
      );
      await audit(
        c,
        { user, orgId: i.org_id, role: i.role },
        "invitation",
        i.id,
        "Invitation accepted",
      );
      return { id: i.org_id };
    });
  }
  const data = z
    .object({
      name: z.string().trim().min(2).max(100),
      slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
      description: z.string().max(4000).default(""),
    })
    .parse(input);
  return transaction(async (c) => {
    const o = (
      await c.query(
        "insert into morrow.organizations(name,slug,description) values($1,$2,$3) returning *",
        [data.name, data.slug, data.description],
      )
    ).rows[0];
    await c.query(
      "insert into morrow.memberships(org_id,user_id,role) values($1,$2,'admin')",
      [o.id, user.id],
    );
    for (const [index, name] of defaultStages.entries())
      await c.query(
        "insert into morrow.pipeline_stages(org_id,name,position) values($1,$2,$3)",
        [o.id, name, index],
      );
    await audit(
      c,
      { user, orgId: o.id, role: "admin" },
      "organization",
      o.id,
      "Organization created",
    );
    return o;
  });
}
export async function settings(ctx: Context, req: Request, path: string[]) {
  allow(ctx, ["admin"]);
  if (req.method === "GET")
    return {
      organization: (
        await pool.query("select * from morrow.organizations where id=$1", [
          ctx.orgId,
        ])
      ).rows[0],
      members: (
        await pool.query(
          "select m.id,m.role,u.id as user_id,u.name,u.email from morrow.memberships m join morrow.users u on u.id=m.user_id where m.org_id=$1",
          [ctx.orgId],
        )
      ).rows,
      invitations: (
        await pool.query(
          "select id,email,role,expires_at,accepted_at from morrow.invitations where org_id=$1 order by created_at desc",
          [ctx.orgId],
        )
      ).rows,
    };
  const input = await req.json();
  return transaction(async (c) => {
    if (path[0] === "invite") {
      const d = z
        .object({
          email: z.email().transform((s) => s.toLowerCase()),
          role: z.enum(["admin", "recruiter", "manager", "interviewer"]),
        })
        .parse(input);
      const token = randomBytes(32).toString("hex");
      const i = (
        await c.query(
          "insert into morrow.invitations(org_id,email,role,token_hash,expires_at) values($1,$2,$3,$4,now()+interval '7 days') returning id",
          [
            ctx.orgId,
            d.email,
            d.role,
            createHash("sha256").update(token).digest("hex"),
          ],
        )
      ).rows[0];
      await audit(c, ctx, "invitation", i.id, "Invitation created", {
        email: d.email,
        role: d.role,
      });
      return {
        url: `${process.env.APP_BASE_URL}/join?token=${token}`,
        delivery:
          "Share this secure link directly. Email delivery is not configured.",
      };
    }
    if (path[0] === "department") {
      const d = z
        .object({ name: z.string().trim().min(2).max(100) })
        .parse(input);
      const r = (
        await c.query(
          "insert into morrow.departments(org_id,name) values($1,$2) returning *",
          [ctx.orgId, d.name],
        )
      ).rows[0];
      await audit(c, ctx, "department", r.id, "Department created");
      return r;
    }
    if (path[0] === "role") {
      const d = z
        .object({
          userId: z.uuid(),
          role: z.enum(["admin", "recruiter", "manager", "interviewer"]),
        })
        .parse(input);
      if (d.userId === ctx.user.id)
        throw new HttpError(
          422,
          "Ask another administrator to change your role.",
        );
      const r = await c.query(
        "update morrow.memberships set role=$1 where org_id=$2 and user_id=$3 returning id",
        [d.role, ctx.orgId, d.userId],
      );
      if (!r.rows[0]) throw new HttpError(404, "Member not found.");
      await audit(c, ctx, "membership", r.rows[0].id, "Role changed", {
        role: d.role,
      });
      return { ok: true };
    }
    if (path[0] === "pipeline") {
      const d = z
        .object({
          stages: z.array(z.string().trim().min(2).max(40)).min(3).max(12),
        })
        .parse(input);
      if (
        d.stages[0] !== "Applied" ||
        d.stages.at(-1) !== "Hired" ||
        !d.stages.includes("Offer") ||
        new Set(d.stages).size !== d.stages.length
      )
        throw new HttpError(
          422,
          "Keep Applied first, Hired last, and an Offer stage. Names must be unique.",
        );
      await c.query(
        "select id from morrow.organizations where id=$1 for update",
        [ctx.orgId],
      );
      const used = await c.query(
        "select distinct stage from morrow.applications where org_id=$1 and status in ('active','hold')",
        [ctx.orgId],
      );
      if (used.rows.some((r) => !d.stages.includes(r.stage)))
        throw new HttpError(
          409,
          "A stage with active or on-hold applications cannot be removed.",
        );
      await c.query("delete from morrow.pipeline_stages where org_id=$1", [
        ctx.orgId,
      ]);
      for (const [i, s] of d.stages.entries())
        await c.query(
          "insert into morrow.pipeline_stages(org_id,name,position) values($1,$2,$3)",
          [ctx.orgId, s, i],
        );
      await audit(c, ctx, "organization", ctx.orgId, "Pipeline updated", {
        stages: d.stages,
      });
      return { ok: true };
    }
    const d = z
      .object({
        name: z.string().min(2).max(100),
        description: z.string().max(4000),
        retention_days: z.number().int().min(30).max(3650),
      })
      .parse(input);
    await c.query(
      "update morrow.organizations set name=$1,description=$2,retention_days=$3 where id=$4",
      [d.name, d.description, d.retention_days, ctx.orgId],
    );
    await audit(c, ctx, "organization", ctx.orgId, "Settings updated");
    return { ok: true };
  });
}
