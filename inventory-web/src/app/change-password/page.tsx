import { redirect } from "next/navigation";

import { ChangePasswordPage } from "@/components/pages/change-password-page";
import { requirePasswordChangeSession } from "@/lib/supabase/route-guards";

export default async function Page() {
  const context = await requirePasswordChangeSession();

  if (!context.profile.must_change_password) {
    redirect("/");
  }

  return <ChangePasswordPage />;
}
