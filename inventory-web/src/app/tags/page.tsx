import { TagsPage } from "@/components/pages/tags-page";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ partId?: string; binId?: string }>;
}>) {
  const resolvedSearchParams = await searchParams;
  return <TagsPage searchParams={resolvedSearchParams} />;
}
