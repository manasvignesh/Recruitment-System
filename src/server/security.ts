import { headers } from "next/headers";
import { auth } from "./auth";
import { pool } from "./db";
import { z } from "zod";
import { HttpError } from "./errors";
export { HttpError } from "./errors";
export type Role = "admin" | "recruiter" | "manager" | "interviewer";
export type Context = {
  user: { id: string; name: string; email: string };
  orgId: string;
  role: Role;
};
export async function identity() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) throw new HttpError(401, "Please sign in to continue.");
  return s.user;
}
export async function context(req: Request): Promise<Context> {
  const user = await identity();
  const orgId = z.uuid().parse(req.headers.get("x-organization-id"));
  const m = await pool.query(
    "select role from morrow.memberships where org_id=$1 and user_id=$2",
    [orgId, user.id],
  );
  if (!m.rows[0])
    throw new HttpError(403, "You do not have access to this organization.");
  return { user, orgId, role: m.rows[0].role };
}
export function allow(ctx: Context, roles: Role[]) {
  if (!roles.includes(ctx.role))
    throw new HttpError(403, "Your role cannot perform this action.");
}
export function canManage(role: Role) {
  return role === "admin" || role === "recruiter";
}
export function verifyOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = new URL(process.env.APP_BASE_URL || "http://localhost:3000")
    .origin;
  if (origin && origin !== expected)
    throw new HttpError(403, "Request origin is not allowed.");
}
export async function appAccess(ctx: Context, id: string) {
  z.uuid().parse(id);
  const r = await pool.query(
    `select a.*, j.title, j.requirements, j.manager_id,c.user_id as candidate_user_id,c.name,c.email,c.phone,c.skills,c.experience,c.talent_consent,c.availability from morrow.applications a join morrow.jobs j on j.id=a.job_id join morrow.candidates c on c.id=a.candidate_id where a.id=$1 and a.org_id=$2 and ($3 in ('admin','recruiter') or ($3='manager' and j.manager_id=$4) or ($3='interviewer' and exists(select 1 from morrow.interviews i where i.application_id=a.id and i.interviewer_id=$4)))`,
    [id, ctx.orgId, ctx.role, ctx.user.id],
  );
  if (!r.rows[0]) throw new HttpError(404, "Application not found.");
  return r.rows[0];
}
export async function jobAccess(ctx: Context, id: string) {
  z.uuid().parse(id);
  const r = await pool.query(
    `select j.* from morrow.jobs j where j.id=$1 and j.org_id=$2 and ($3 in ('admin','recruiter') or j.manager_id=$4 or exists(select 1 from morrow.interviews i join morrow.applications a on a.id=i.application_id where a.job_id=j.id and i.interviewer_id=$4))`,
    [id, ctx.orgId, ctx.role, ctx.user.id],
  );
  if (!r.rows[0]) throw new HttpError(404, "Position not found.");
  return r.rows[0];
}
export function failure(e: unknown) {
  if (e instanceof z.ZodError)
    return Response.json(
      {
        error: e.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 422 },
    );
  if (e instanceof HttpError)
    return Response.json({ error: e.message }, { status: e.status });
  const code = (e as { code?: string })?.code;
  if (code === "23505")
    return Response.json(
      { error: "This record already exists." },
      { status: 409 },
    );
  if (code === "23503")
    return Response.json(
      { error: "A related record is unavailable." },
      { status: 409 },
    );
  console.error("Morrow request failed", {
    type: e instanceof Error ? e.name : "Unknown",
    code,
  });
  return Response.json(
    { error: "Unable to complete the request. Please try again." },
    { status: 500 },
  );
}
