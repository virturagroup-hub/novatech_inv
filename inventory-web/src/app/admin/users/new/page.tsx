import { AdminUserFormPage } from "@/components/pages/admin-user-form-page";
import { requireAdminSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  const context = await requireAdminSession({ nextPath: "/admin/users/new" });
  return <AdminUserFormPage mode="create" currentUserId={context.userId} />;
}
