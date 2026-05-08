import { Suspense } from "react";
import { InventoryPage } from "@/components/pages/inventory-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  await requireAppSession({ nextPath: "/inventory" });
  return (
    <Suspense fallback={<div className="px-4 py-10 text-sm text-slate-400">Loading inventory…</div>}>
      <InventoryPage />
    </Suspense>
  );
}
