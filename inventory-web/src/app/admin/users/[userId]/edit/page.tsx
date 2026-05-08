import { AdminUserFormPage } from "@/components/pages/admin-user-form-page";
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
  const authUser = authUsers?.users.find((item) => item.id === userId);

  const user = profile
    ? ({
        ...(profile as ProfileRow),
        auth_created_at: authUser?.created_at ?? null,
        auth_email: authUser?.email ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
      } as ProfileRow & {
        auth_created_at: string | null;
        auth_email: string | null;
        last_sign_in_at: string | null;
      })
    : null;

  return <AdminUserFormPage mode="edit" user={user} currentUserId={context.userId} />;
}
