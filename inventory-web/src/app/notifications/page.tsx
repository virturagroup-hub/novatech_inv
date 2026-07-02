import { NotificationsPage } from "@/components/pages/notifications-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireAppSession({ nextPath: "/notifications" });
  return <NotificationsPage />;
}
