import { PartEditorPage } from "@/components/pages/part-editor-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ partId: string }>;
}>) {
  await requireAppSession();
  const { partId } = await params;
  return <PartEditorPage mode="edit" partId={partId} />;
}
