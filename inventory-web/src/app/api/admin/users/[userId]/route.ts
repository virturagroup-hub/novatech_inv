import { NextResponse } from "next/server";

import type { UserRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveAdminCount } from "@/lib/supabase/admin-user-safety";
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

  if (userId === context.userId && (role !== existingProfile.role || active !== existingProfile.active)) {
    return NextResponse.json(
      { error: "You cannot remove your own admin access from this screen." },
      { status: 403 },
    );
  }

  const activeAdminCount = await getActiveAdminCount(admin, userId);
  const targetWillBeActiveAdmin = role === "admin" && active;

  if (activeAdminCount + (targetWillBeActiveAdmin ? 1 : 0) < 1) {
    return NextResponse.json(
      { error: "At least one active admin account must remain." },
      { status: 403 },
    );
  }

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h",
    user_metadata: {
      full_name: fullName,
    },
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const context = await getServerAuthContext();

  if (!context || !context.profile.active) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  if (context.profile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can delete users." }, { status: 403 });
  }

  const { userId } = await params;

  if (userId === context.userId) {
    return NextResponse.json(
      { error: "You cannot delete your own account from this screen." },
      { status: 403 },
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

  if (existingProfile.role === "admin" && existingProfile.active) {
    const activeAdminCount = await getActiveAdminCount(admin, userId);

    if (activeAdminCount < 1) {
      return NextResponse.json(
        { error: "At least one active admin account must remain." },
        { status: 403 },
      );
    }
  }

  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message ?? "Unable to delete the profile." },
      { status: 500 },
    );
  }

  const { error: authError } = await admin.auth.admin.deleteUser(userId);

  if (authError) {
    return NextResponse.json(
      { error: authError.message ?? "Unable to delete the auth account." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

