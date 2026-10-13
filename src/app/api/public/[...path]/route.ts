import { careers, portal } from "@/server/domains/public";
import { downloadDocument } from "@/server/domains/files";
import { failure, HttpError } from "@/server/security";
import { emailConfigured } from "@/server/email";
export const dynamic = "force-dynamic";
async function handler(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    if (path[0] === "config" && req.method === "GET")
      return Response.json({ emailConfigured });
    if (path[0] === "careers")
      return Response.json(await careers(req, path.slice(1)));
    if (path[0] === "portal")
      return Response.json(await portal(req, path.slice(1)), {
        headers: { "Cache-Control": "private, no-store" },
      });
    if (path[0] === "files" && req.method === "GET")
      return await downloadDocument(req, path[1]);
    throw new HttpError(404, "Route not found.");
  } catch (e) {
    return failure(e);
  }
}
export { handler as GET, handler as POST };
