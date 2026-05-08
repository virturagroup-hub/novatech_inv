import { ActivityPage } from "@/components/pages/activity-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireAppSession();
  return <ActivityPage />;
}
