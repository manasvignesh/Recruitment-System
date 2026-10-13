import { Careers } from "@/components/careers";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; jobId: string }>;
}) {
  const { slug, jobId } = await params;
  return <Careers slug={slug} jobId={jobId} />;
}
