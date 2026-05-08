import { PrintPage } from "@/components/pages/print-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

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
  await requireAppSession();
  return <PrintPage searchParams={params} />;
}
