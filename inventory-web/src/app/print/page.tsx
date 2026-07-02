import { PrintPage } from "@/components/pages/print-page";
import { requirePrintLabelsSession } from "@/lib/supabase/route-guards";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    partId?: string;
    partIds?: string;
    binId?: string;
    machineId?: string;
    copies?: string;
    labelMode?: string;
    includeZero?: string;
    copiesByPart?: string;
    layout?: string;
  }>;
}>) {
  const resolvedSearchParams = await searchParams;
  const query = new URLSearchParams();

  if (resolvedSearchParams.partId) query.set("partId", resolvedSearchParams.partId);
  if (resolvedSearchParams.partIds) query.set("partIds", resolvedSearchParams.partIds);
  if (resolvedSearchParams.binId) query.set("binId", resolvedSearchParams.binId);
  if (resolvedSearchParams.machineId) query.set("machineId", resolvedSearchParams.machineId);
  if (resolvedSearchParams.copies) query.set("copies", resolvedSearchParams.copies);
  if (resolvedSearchParams.labelMode) query.set("labelMode", resolvedSearchParams.labelMode);
  if (resolvedSearchParams.includeZero) query.set("includeZero", resolvedSearchParams.includeZero);
  if (resolvedSearchParams.copiesByPart) query.set("copiesByPart", resolvedSearchParams.copiesByPart);
  if (resolvedSearchParams.layout) query.set("layout", resolvedSearchParams.layout);

  const nextPath = query.toString() ? `/print?${query.toString()}` : "/print";

  await requirePrintLabelsSession({ nextPath });
  return <PrintPage searchParams={resolvedSearchParams} />;
}
