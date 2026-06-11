import { NextResponse } from "next/server";

import { mergeAppMetadata } from "@/lib/supabase/auth-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerAuthContext } from "@/lib/supabase/session";

export async function POST() {
  const context = await getServerAuthContext();

  if (!context || !context.profile.active) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(
    context.userId,
  );

  if (authUserError || !authUserData.user) {
    return NextResponse.json({ error: "That auth user could not be found." }, { status: 404 });
  }

  const { error } = await admin.auth.admin.updateUserById(context.userId, {
    app_metadata: mergeAppMetadata(authUserData.user.app_metadata, {
      must_change_password: false,
    }),
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Unable to finish the password change." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
