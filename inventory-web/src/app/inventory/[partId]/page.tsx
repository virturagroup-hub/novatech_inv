import { PartDetailPage } from "@/components/pages/part-detail-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ partId: string }>;
}>) {
  const { partId } = await params;
  await requireAppSession({ nextPath: `/inventory/${partId}` });
  return <PartDetailPage partId={partId} />;
}
