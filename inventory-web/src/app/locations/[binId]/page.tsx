import { LocationDetailPage } from "@/components/pages/location-detail-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ binId: string }>;
}>) {
  const { binId } = await params;
  await requireAppSession({ nextPath: `/locations/${binId}` });
  return <LocationDetailPage binId={binId} />;
}
