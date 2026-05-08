import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getServerAuthContext } from "@/lib/supabase/session";

export async function POST() {
  const context = await getServerAuthContext();

  if (!context || !context.profile.active) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({
      must_change_password: false,
    })
    .eq("id", context.userId);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Unable to finish the password change." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
