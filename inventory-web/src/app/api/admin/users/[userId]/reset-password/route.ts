import { NextResponse } from "next/server";

import { generateTemporaryPassword } from "@/lib/password";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerAuthContext } from "@/lib/supabase/session";

type ResetPasswordRequest = {
  temporaryPassword?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const context = await getServerAuthContext();

  if (!context || !context.profile.active) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  if (context.profile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can reset passwords." }, { status: 403 });
  }

  const { userId } = await params;

  let payload: ResetPasswordRequest | null = null;

  try {
    payload = (await request.json().catch(() => ({}))) as ResetPasswordRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const temporaryPassword =
    payload?.temporaryPassword?.trim() || generateTemporaryPassword();

  if (temporaryPassword.length < 10) {
    return NextResponse.json(
      { error: "Temporary passwords must be at least 10 characters long." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: existingProfile, error: fetchError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError || !existingProfile) {
    return NextResponse.json({ error: "That user profile could not be found." }, { status: 404 });
  }

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
    user_metadata: {
      full_name: existingProfile.full_name,
    },
  });

  if (authError) {
    return NextResponse.json(
      { error: authError.message ?? "Unable to reset the password." },
      { status: 500 },
    );
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      must_change_password: true,
      active: true,
    })
    .eq("id", userId);

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message ?? "Unable to update the profile." },
      { status: 500 },
    );
  }

  return NextResponse.json({ temporaryPassword });
}

