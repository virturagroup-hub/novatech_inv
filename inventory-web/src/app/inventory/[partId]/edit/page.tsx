import { PartEditorPage } from "@/components/pages/part-editor-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ partId: string }>;
}>) {
  const { partId } = await params;
  await requireAppSession({ nextPath: `/inventory/${partId}/edit` });
  return <PartEditorPage mode="edit" partId={partId} />;
}
