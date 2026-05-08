import { redirect } from "next/navigation";

import { AdminUsersPage } from "@/components/pages/admin-users-page";
import { requireUserManagementSession } from "@/lib/supabase/route-guards";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/types";

export default async function Page() {
  await requireUserManagementSession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    redirect("/");
  }

  return <AdminUsersPage users={(data ?? []) as ProfileRow[]} />;
}
