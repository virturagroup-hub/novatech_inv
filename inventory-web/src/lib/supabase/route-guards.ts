import { redirect } from "next/navigation";

import type { UserRole } from "@/lib/auth";

import { getServerAuthContext } from "./session";

export async function requireAuthenticatedSession() {
  const context = await getServerAuthContext();

  if (!context || !context.profile.active) {
    redirect("/login");
  }

  return context;
}

export async function requireAppSession() {
  const context = await requireAuthenticatedSession();

  if (context.profile.must_change_password) {
    redirect("/change-password");
  }

  return context;
}

export async function requirePasswordChangeSession() {
  const context = await requireAuthenticatedSession();

  if (!context.profile.must_change_password) {
    redirect("/");
  }

  return context;
}

export async function requireUserManagementSession() {
  const context = await requireAppSession();

  if (!["admin", "manager"].includes(context.profile.role)) {
    redirect("/");
  }

  return context;
}

export async function requireAdminSession() {
  const context = await requireAppSession();

  if (context.profile.role !== "admin") {
    redirect("/");
  }

  return context;
}

export async function redirectAuthenticatedUser(options?: {
  nextPath?: string;
}) {
  const context = await getServerAuthContext();

  if (!context || !context.profile.active) {
    return;
  }

  if (context.profile.must_change_password) {
    redirect("/change-password");
  }

  redirect(options?.nextPath ?? "/");
}

export function canAccessUserManagement(role: UserRole) {
  return role === "admin" || role === "manager";
}
