import { TagsPage } from "@/components/pages/tags-page";
import { requirePrintLabelsSession } from "@/lib/supabase/route-guards";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    partId?: string;
    partIds?: string;
    binId?: string;
    mode?: string;
    labelMode?: string;
    copies?: string;
    includeZero?: string;
  }>;
}>) {
  const resolvedSearchParams = await searchParams;
  await requirePrintLabelsSession({ nextPath: "/tags" });
  return <TagsPage searchParams={resolvedSearchParams} />;
}
