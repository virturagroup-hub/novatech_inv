import { PrintPage } from "@/components/pages/print-page";

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
  return <PrintPage searchParams={resolvedSearchParams} />;
}
