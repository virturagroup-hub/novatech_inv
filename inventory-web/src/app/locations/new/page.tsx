import { LocationEditorPage } from "@/components/pages/location-editor-page";
import { requireManageLocationsSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireManageLocationsSession({ nextPath: "/locations/new" });
  return <LocationEditorPage mode="create" />;
}

