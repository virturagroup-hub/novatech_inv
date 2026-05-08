import { SettingsPage } from "@/components/pages/settings-page";
import { requireAccessSettingsSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireAccessSettingsSession({ nextPath: "/settings" });
  return <SettingsPage />;
}
