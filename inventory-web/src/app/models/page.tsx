import { ModelsPage } from "@/components/pages/models-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireAppSession({ nextPath: "/models" });
  return <ModelsPage />;
}
