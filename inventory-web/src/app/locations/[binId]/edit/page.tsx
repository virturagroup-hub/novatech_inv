import { LocationEditorPage } from "@/components/pages/location-editor-page";
import { requireManageLocationsSession } from "@/lib/supabase/route-guards";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ binId: string }>;
}>) {
  const { binId } = await params;
  await requireManageLocationsSession({ nextPath: `/locations/${binId}/edit` });
  return <LocationEditorPage mode="edit" binId={binId} />;
}

