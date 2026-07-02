import { FeatureRequestsPage } from "@/components/pages/feature-requests-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams?: {
    threadId?: string;
  };
}>) {
  await requireAppSession({ nextPath: "/feature-requests" });
  return <FeatureRequestsPage searchParams={searchParams} />;
}
