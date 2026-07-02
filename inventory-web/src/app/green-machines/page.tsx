import { GreenMachinesPage } from "@/components/pages/green-machines-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireAppSession({ nextPath: "/green-machines" });
  return <GreenMachinesPage />;
}
