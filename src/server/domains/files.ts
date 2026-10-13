import { validateDocument } from "../file-policy";
import { HttpError, identity } from "../security";
import { pool } from "../db";
export type Upload = {
  name: string;
  mime: string;
  size: number;
  bytes: Buffer;
  text: string | null;
  status: "parsed" | "failed";
};
export async function boundedForm(req: Request, maxBytes = 3 * 1024 * 1024) {
  if (Number(req.headers.get("content-length")) > maxBytes)
    throw new HttpError(413, "The upload is too large.");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(422, "Upload a resume.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "The upload is too large.");
    }
    chunks.push(value);
  }
  return new Response(new Uint8Array(Buffer.concat(chunks)), {
    headers: { "Content-Type": req.headers.get("content-type") || "" },
  }).formData();
}
export async function processUpload(file: File): Promise<Upload> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = validateDocument(file.name, file.type, bytes);
  let text: string | null = null;
  let status: "parsed" | "failed" = "failed";
  try {
    if (type === "docx") {
      const { extractRawText } = await import("mammoth");
      text = (await extractRawText({ buffer: bytes })).value.slice(0, 100000);
    } else {
      const { PDFParse } = await import("pdf-parse");
      const p = new PDFParse({ data: bytes });
      try {
        text = (await p.getText()).text.slice(0, 100000);
      } finally {
        await p.destroy();
      }
    }
    status = "parsed";
  } catch {
    /* Original remains accessible; extraction failure is visible. */
  }
  return {
    name: file.name.replace(/[\r\n\/\\]/g, "_").slice(0, 200),
    mime: file.type,
    size: bytes.length,
    bytes,
    text,
    status,
  };
}
export async function downloadDocument(req: Request, id: string) {
  const user = await identity();
  const org =
    req.headers.get("x-organization-id") ||
    new URL(req.url).searchParams.get("org");
  const r = await pool.query(
    `select d.* from morrow.documents d join morrow.candidates c on c.id=d.candidate_id where d.id=$1 and (c.user_id=$2 or exists(select 1 from morrow.memberships m where m.user_id=$2 and m.org_id=d.org_id and m.org_id=$3::uuid and (m.role in ('admin','recruiter') or exists(select 1 from morrow.applications a join morrow.jobs j on j.id=a.job_id where a.candidate_id=c.id and ((m.role='manager' and j.manager_id=$2) or (m.role='interviewer' and exists(select 1 from morrow.interviews i where i.application_id=a.id and i.interviewer_id=$2)))))))`,
    [id, user.id, org],
  );
  const d = r.rows[0];
  if (!d) throw new HttpError(404, "Document not found.");
  if (new URL(req.url).searchParams.get("text") === "true")
    return Response.json(
      { id: d.id, text: d.extracted_text, status: d.parsing_status },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  return new Response(new Uint8Array(d.content), {
    headers: {
      "Content-Type": d.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
