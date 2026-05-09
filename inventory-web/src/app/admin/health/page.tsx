import { AdminHealthPage } from "@/components/pages/admin-health-page";
import { buildAdminHealthReport } from "@/lib/admin-health";
import { requireAdminSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  const context = await requireAdminSession({ nextPath: "/admin/health" });
  const report = await buildAdminHealthReport(context.supabase);

  return <AdminHealthPage initialReport={report} />;
}
