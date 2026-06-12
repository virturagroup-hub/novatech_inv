import { ModelDetailPage } from "@/components/pages/model-detail-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ modelId: string }>;
}>) {
  const { modelId } = await params;
  await requireAppSession({ nextPath: `/models/${modelId}` });
  return <ModelDetailPage modelId={modelId} />;
}
