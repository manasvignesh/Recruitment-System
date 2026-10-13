import { pool } from "@/server/db";
import {
  context,
  identity,
  appAccess,
  verifyOrigin,
  failure,
  HttpError,
} from "@/server/security";
import { organizations, settings } from "@/server/domains/organizations";
import { jobs } from "@/server/domains/jobs";
import { applications } from "@/server/domains/applications";
import { interviews } from "@/server/domains/interviews";
import { offers } from "@/server/domains/offers";
import { operations, ics } from "@/server/domains/operations";
import { analytics } from "@/server/domains/analytics";
import { privacy } from "@/server/domains/privacy";
import { notifications } from "@/server/domains/notifications";
import { bulk } from "@/server/domains/bulk";
import { pulse } from "@/server/domains/pulse";
import { talentPools } from "@/server/domains/talent-pools";
export const dynamic = "force-dynamic";
async function handler(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    if (req.method !== "GET") verifyOrigin(req);
    if (path[0] === "me") return Response.json({ user: await identity() });
    if (path[0] === "organizations")
      return Response.json(await organizations(req, path.slice(1)));
    const ctx = await context(req);
    let result;
    if (path[0] === "pools")
      result = await talentPools(ctx, req, path.slice(1));
    else if (path[0] === "pulse") result = await pulse(ctx);
    else if (path[0] === "notifications")
      result = await notifications(ctx, req);
    else if (path[0] === "privacy")
      result = await privacy(ctx, req, path.slice(1));
    else if (path[0] === "settings")
      result = await settings(ctx, req, path.slice(1));
    else if (path[0] === "jobs") result = await jobs(ctx, req, path.slice(1));
    else if (
      path[0] === "applications" &&
      path[1] === "bulk" &&
      req.method === "POST"
    )
      result = await bulk(ctx, req);
    else if (path[0] === "applications")
      result = await applications(ctx, req, path.slice(1));
    else if (
      path[0] === "interviews" &&
      path[2] === "ics" &&
      req.method === "GET"
    ) {
      const i = (
        await pool.query(
          "select * from morrow.interviews where org_id=$1 and id=$2",
          [ctx.orgId, path[1]],
        )
      ).rows[0];
      if (!i) throw new HttpError(404, "Interview not found.");
      await appAccess(ctx, i.application_id);
      return new Response(ics(i), {
        headers: {
          "Content-Type": "text/calendar",
          "Content-Disposition": "attachment; filename=interview.ics",
        },
      });
    } else if (path[0] === "interviews")
      result = await interviews(ctx, req, path.slice(1));
    else if (path[0] === "offers")
      result = await offers(ctx, req, path.slice(1));
    else if (path[0] === "analytics") result = await analytics(ctx, req);
    else result = await operations(ctx, req, path);
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export { handler as GET, handler as POST, handler as PATCH };
