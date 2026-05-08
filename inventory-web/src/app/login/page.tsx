import { LoginScreen } from "@/components/login-screen";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ next?: string }>;
}>) {
  const params = await searchParams;
  return <LoginScreen nextPath={params.next ?? "/"} />;
}

