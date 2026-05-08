import { redirect } from "next/navigation";

import { AdminUsersPage } from "@/components/pages/admin-users-page";
import { requireAdminSession } from "@/lib/supabase/route-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileRow } from "@/lib/supabase/types";

export default async function Page() {
  const context = await requireAdminSession({ nextPath: "/admin/users" });
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    redirect("/");
  }

  const { data: authUsers } = await supabase.auth.admin.listUsers().catch(() => ({
    data: null,
  }));

  return (
    <AdminUsersPage
      currentUserId={context.userId}
      users={(data ?? []) as ProfileRow[]}
      authUsers={authUsers?.users ?? []}
    />
  );
}
