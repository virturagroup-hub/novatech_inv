import { ChangePasswordPage } from "@/components/pages/change-password-page";
import { requirePasswordChangeSession } from "@/lib/supabase/route-guards";
import { sanitizeInternalPath } from "@/lib/navigation";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ next?: string }>;
}>) {
  const params = await searchParams;
  const nextPath = sanitizeInternalPath(params.next);
  await requirePasswordChangeSession({ nextPath });
  return <ChangePasswordPage nextPath={nextPath} />;
}
