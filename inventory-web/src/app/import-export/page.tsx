import { ImportExportPage } from "@/components/pages/import-export-page";
import { requireReportsSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireReportsSession({ nextPath: "/import-export" });
  return <ImportExportPage />;
}
