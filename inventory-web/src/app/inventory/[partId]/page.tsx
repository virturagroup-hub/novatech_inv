import { PartDetailPage } from "@/components/pages/part-detail-page";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ partId: string }>;
}>) {
  const { partId } = await params;
  return <PartDetailPage partId={partId} />;
}
