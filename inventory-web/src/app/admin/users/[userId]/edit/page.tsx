import { AdminUserFormPage } from "@/components/pages/admin-user-form-page";
import { mergeAdminUsers } from "@/lib/admin-users";
import { requireAdminSession } from "@/lib/supabase/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileRow } from "@/lib/supabase/types";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ userId: string }>;
}>) {
  const { userId } = await params;
  const context = await requireAdminSession({ nextPath: `/admin/users/${userId}/edit` });
  const admin = createAdminClient();

  const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  const { data: authUsers } = await admin.auth.admin.listUsers().catch(() => ({
    data: null,
  }));
  const user = profile
    ? mergeAdminUsers([profile as ProfileRow], authUsers?.users ?? []).at(0) ?? null
    : null;

  return <AdminUserFormPage mode="edit" user={user} currentUserId={context.userId} />;
}
