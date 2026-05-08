import { ModelEditorPage } from "@/components/pages/model-editor-page";
import { requireManageModelsSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireManageModelsSession({ nextPath: "/models/new" });
  return <ModelEditorPage mode="create" />;
}

