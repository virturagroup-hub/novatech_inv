import { Suspense } from "react";
import { InventoryPage } from "@/components/pages/inventory-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="px-4 py-10 text-sm text-slate-400">Loading inventory…</div>}>
      <InventoryPage />
    </Suspense>
  );
}
