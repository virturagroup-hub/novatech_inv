import { UpdatesPage } from "@/components/pages/updates-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireAppSession({ nextPath: "/updates" });
  return <UpdatesPage />;
}
