import { pool } from "../db";
import { identity, HttpError } from "../security";
import { z } from "zod";
const escape = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function offerDocument(req: Request, id: string) {
  const user = await identity();
  z.uuid().parse(id);
  const org = new URL(req.url).searchParams.get("org") || null;
  if (org) z.uuid().parse(org);
  const o = (
    await pool.query(
      `select o.*,c.name,c.user_id,j.title,j.location,n.name as company from morrow.offers o join morrow.applications a on a.id=o.application_id join morrow.candidates c on c.id=a.candidate_id join morrow.jobs j on j.id=a.job_id join morrow.organizations n on n.id=o.org_id where o.id=$1 and ((c.user_id=$2 and o.status in ('available','accepted','declined','expired')) or exists(select 1 from morrow.memberships m where m.org_id=o.org_id and m.org_id=$3::uuid and m.user_id=$2 and (m.role in ('admin','recruiter') or (m.role='manager' and j.manager_id=$2))))`,
      [id, user.id, org],
    )
  ).rows[0];
  if (!o) throw new HttpError(404, "Offer not found.");
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Employment offer</title><style>body{font:16px/1.7 Georgia,serif;max-width:720px;margin:70px auto;padding:25px;color:#202522}h1{font-weight:400}small{color:#657067}pre{font:inherit;white-space:pre-wrap;border-top:1px solid #ddd;padding-top:25px}</style><h1>Employment offer</h1><small>${escape(o.company)} · Version ${o.version} · Status ${escape(o.status)}</small><p>Dear ${escape(o.name)},</p><p>We are pleased to offer you the position of <strong>${escape(o.title)}</strong> at ${escape(o.company)}.</p><p>Location: ${escape(o.location)}<br>Annual compensation: ${escape(o.currency)} ${escape(o.compensation)}<br>Proposed start: ${escape(new Date(o.start_date).toISOString().slice(0, 10))}<br>Offer expires: ${escape(new Date(o.expires_at).toISOString().slice(0, 10))}</p><pre>${escape(o.terms)}</pre><p><small>This document records the terms available in Morrow. Candidate acceptance in Morrow is an acknowledgement, not an electronic signature or completed employment contract.</small></p></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": "attachment; filename=employment-offer.html",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      },
    },
  );
}
