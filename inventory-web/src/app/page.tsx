import { DashboardPage } from "@/components/pages/dashboard-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireAppSession();
  return <DashboardPage />;
}
