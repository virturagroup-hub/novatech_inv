import { PartDetailPage } from "@/components/pages/part-detail-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ partId: string }>;
}>) {
  await requireAppSession();
  const { partId } = await params;
  return <PartDetailPage partId={partId} />;
}
