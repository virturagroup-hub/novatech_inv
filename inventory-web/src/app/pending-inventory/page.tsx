import { SalvageWorkflow } from "@/components/salvage-workflow";
import { requireManageLocationsSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireManageLocationsSession({ nextPath: "/pending-inventory" });
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <SalvageWorkflow />
    </div>
  );
}
