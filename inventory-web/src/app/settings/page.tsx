import { SettingsPage } from "@/components/pages/settings-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireAppSession({ nextPath: "/settings" });
  return <SettingsPage />;
}
