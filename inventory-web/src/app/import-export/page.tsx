import { ImportExportPage } from "@/components/pages/import-export-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireAppSession({ nextPath: "/import-export" });
  return <ImportExportPage />;
}
