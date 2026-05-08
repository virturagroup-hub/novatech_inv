import { PartEditorPage } from "@/components/pages/part-editor-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireAppSession({ nextPath: "/inventory/new" });
  return <PartEditorPage mode="create" />;
}
