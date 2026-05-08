import { NextResponse } from "next/server";

import type { UserRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerAuthContext } from "@/lib/supabase/session";

type UpdateUserRequest = {
  fullName: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
};

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "manager" || value === "technician" || value === "viewer";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const context = await getServerAuthContext();

  if (!context || !context.profile.active) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  if (context.profile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can edit users." }, { status: 403 });
  }

  const { userId } = await params;

  let payload: Partial<UpdateUserRequest>;

  try {
    payload = (await request.json()) as Partial<UpdateUserRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const fullName = payload.fullName?.trim() ?? "";
  const role = payload.role;
  const active = Boolean(payload.active);
  const mustChangePassword = Boolean(payload.mustChangePassword);

  if (!fullName) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  if (!isUserRole(role)) {
    return NextResponse.json({ error: "Select a valid role." }, { status: 400 });
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
    ban_duration: active ? "none" : "876000h",
  });

  if (authError) {
    return NextResponse.json(
      { error: authError.message ?? "Unable to update the auth record." },
      { status: 500 },
    );
  }

  const { data: profileData, error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      role,
      active,
      must_change_password: mustChangePassword,
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message ?? "Unable to update the profile." },
      { status: 500 },
    );
  }

  return NextResponse.json({ user: profileData });
}
