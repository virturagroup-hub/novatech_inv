import { LoginScreen } from "@/components/login-screen";
import { redirectAuthenticatedUser } from "@/lib/supabase/route-guards";
import type { AuthBlockReason } from "@/lib/auth";
import { sanitizeInternalPath } from "@/lib/navigation";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ next?: string; reason?: AuthBlockReason }>;
}>) {
  const params = await searchParams;
  const nextPath = sanitizeInternalPath(params.next);

  await redirectAuthenticatedUser({ nextPath });
  return <LoginScreen nextPath={nextPath} reason={params.reason ?? null} />;
}
