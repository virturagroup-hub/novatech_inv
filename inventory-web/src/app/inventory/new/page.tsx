import { PartEditorPage } from "@/components/pages/part-editor-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireAppSession();
  return <PartEditorPage mode="create" />;
}
