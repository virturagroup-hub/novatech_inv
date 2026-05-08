import { LoginScreen } from "@/components/login-screen";
import { redirectAuthenticatedUser } from "@/lib/supabase/route-guards";
import type { AuthBlockReason } from "@/lib/auth";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ next?: string; reason?: AuthBlockReason }>;
}>) {
  const params = await searchParams;
  await redirectAuthenticatedUser({ nextPath: params.next ?? "/" });
  return <LoginScreen nextPath={params.next ?? "/"} reason={params.reason ?? null} />;
}
