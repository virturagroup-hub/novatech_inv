import { ForumPage } from "@/components/pages/forum-page";
import { requireAppSession } from "@/lib/supabase/route-guards";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams?: {
    threadId?: string;
  };
}>) {
  await requireAppSession({ nextPath: "/forum" });
  return <ForumPage searchParams={searchParams} />;
}
