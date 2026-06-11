import { NextResponse } from "next/server";

import type { UserRole } from "@/lib/auth";
import { mergeAppMetadata } from "@/lib/supabase/auth-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerAuthContext } from "@/lib/supabase/session";

type CreateUserRequest = {
  fullName: string;
  email: string;
  role: UserRole;
  temporaryPassword: string;
};

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "manager" || value === "technician" || value === "viewer";
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();

  if (!context || !context.profile.active) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  if (context.profile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can create users." }, { status: 403 });
  }

  let payload: Partial<CreateUserRequest>;

  try {
    payload = (await request.json()) as Partial<CreateUserRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const fullName = payload.fullName?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const temporaryPassword = payload.temporaryPassword ?? "";
  const role = payload.role;

  if (!fullName) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  if (!temporaryPassword || temporaryPassword.length < 10) {
    return NextResponse.json(
      { error: "Temporary passwords must be at least 10 characters long." },
      { status: 400 },
    );
  }

  if (!isUserRole(role)) {
    return NextResponse.json({ error: "Select a valid role." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (createError || !authData.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Unable to create the auth user." },
      { status: 500 },
    );
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(authData.user.id, {
    app_metadata: mergeAppMetadata(authData.user.app_metadata, {
      must_change_password: true,
    }),
  });

  if (metadataError) {
    await admin.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
    return NextResponse.json(
      { error: metadataError.message ?? "Unable to update the auth metadata." },
      { status: 500 },
    );
  }

  const { data: profileData, error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: authData.user.id,
        full_name: fullName,
        role,
        active: true,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
    return NextResponse.json(
      { error: profileError.message ?? "Unable to save the profile." },
      { status: 500 },
    );
  }

  return NextResponse.json({ user: profileData }, { status: 201 });
}
