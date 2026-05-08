import { PartEditorPage } from "@/components/pages/part-editor-page";
import { requireManagePartsSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireManagePartsSession({ nextPath: "/inventory/new" });
  return <PartEditorPage mode="create" />;
}
