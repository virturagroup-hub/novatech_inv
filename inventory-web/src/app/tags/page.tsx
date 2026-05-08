import { TagsPage } from "@/components/pages/tags-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ partId?: string; binId?: string; mode?: string }>;
}>) {
  const resolvedSearchParams = await searchParams;
  await requireAppSession();
  return <TagsPage searchParams={resolvedSearchParams} />;
}
