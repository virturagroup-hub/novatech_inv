import { PrintPage } from "@/components/pages/print-page";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    partId?: string;
    binId?: string;
    copies?: string;
  }>;
}>) {
  const params = await searchParams;
  return <PrintPage searchParams={params} />;
}

