import { SupportHubPage } from "@/components/pages/support-hub-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams?: {
    threadId?: string;
  };
}>) {
  await requireAppSession({ nextPath: "/support" });
  return <SupportHubPage searchParams={searchParams} />;
}
