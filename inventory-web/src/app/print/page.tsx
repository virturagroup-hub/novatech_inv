import { PrintPage } from "@/components/pages/print-page";
import { requirePrintLabelsSession } from "@/lib/supabase/route-guards";

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
  const resolvedSearchParams = await searchParams;
  await requirePrintLabelsSession({ nextPath: "/print" });
  return <PrintPage searchParams={resolvedSearchParams} />;
}
