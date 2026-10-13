import type { PoolClient } from "pg";
import type { Context } from "./security";
export async function audit(
  c: PoolClient,
  ctx: Context,
  type: string,
  id: string,
  action: string,
  detail: Record<string, unknown> = {},
  visible = false,
) {
  await c.query(
    "insert into morrow.audit_events(org_id,actor_id,entity_type,entity_id,action,detail,public) values($1,$2,$3,$4,$5,$6,$7)",
    [ctx.orgId, ctx.user.id, type, id, action, JSON.stringify(detail), visible],
  );
}
