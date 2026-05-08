import { ActivityPage } from "@/components/pages/activity-page";
import { requireActivitySession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireActivitySession({ nextPath: "/activity" });
  return <ActivityPage />;
}
