import { LoginScreen } from "@/components/login-screen";
import { redirectAuthenticatedUser } from "@/lib/supabase/route-guards";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ next?: string }>;
}>) {
  const params = await searchParams;
  await redirectAuthenticatedUser({ nextPath: params.next ?? "/" });
  return <LoginScreen nextPath={params.next ?? "/"} />;
}
