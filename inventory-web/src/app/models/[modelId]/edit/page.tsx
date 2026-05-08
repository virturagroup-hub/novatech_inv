import { ModelEditorPage } from "@/components/pages/model-editor-page";
import { requireManageModelsSession } from "@/lib/supabase/route-guards";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ modelId: string }>;
}>) {
  const { modelId } = await params;
  await requireManageModelsSession({ nextPath: `/models/${modelId}/edit` });
  return <ModelEditorPage mode="edit" modelId={modelId} />;
}

