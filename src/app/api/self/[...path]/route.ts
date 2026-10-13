import { selfService } from "@/server/domains/self-service";
import { failure } from "@/server/security";
import { offerDocument } from "@/server/domains/offer-document";
export const dynamic = "force-dynamic";
async function handler(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    if (path[0] === "offer" && req.method === "GET")
      return await offerDocument(req, path[1]);
    return await selfService(req, path);
  } catch (e) {
    return failure(e);
  }
}
export { handler as GET, handler as POST };
