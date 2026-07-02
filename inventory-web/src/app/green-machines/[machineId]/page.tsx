import { GreenMachineDetailPage } from "@/components/pages/green-machine-detail-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ machineId: string }>;
}>) {
  const { machineId } = await params;
  await requireAppSession({ nextPath: `/green-machines/${machineId}` });
  return <GreenMachineDetailPage machineId={machineId} />;
}
