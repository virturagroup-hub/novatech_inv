import { PrintPage } from "@/components/pages/print-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    partId?: string;
    partIds?: string;
    binId?: string;
    copies?: string;
    labelMode?: string;
    includeZero?: string;
  }>;
}>) {
  const params = await searchParams;
  await requireAppSession({ nextPath: "/print" });
  return <PrintPage searchParams={params} />;
}
