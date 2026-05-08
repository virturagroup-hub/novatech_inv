import { redirect } from "next/navigation";

import type { AuthBlockReason, UserRole } from "@/lib/auth";

import { getServerAuthResolution } from "./session";

function loginRedirectPath(reason: AuthBlockReason | null) {
  return reason ? `/login?reason=${reason}` : "/login";
}

export async function requireAuthenticatedSession() {
  const resolution = await getServerAuthResolution();

  if (resolution.state !== "authenticated") {
    redirect(loginRedirectPath(resolution.reason));
  }

  return resolution.context;
}

export async function requireAppSession() {
  const context = await requireAuthenticatedSession();

  if (context.profile.must_change_password) {
    redirect("/change-password");
  }

  return context;
}

export async function requirePasswordChangeSession() {
  const resolution = await getServerAuthResolution();

  if (resolution.state !== "authenticated") {
    redirect(loginRedirectPath(resolution.reason));
  }

  if (!resolution.context.profile.must_change_password) {
    redirect("/");
  }

  return resolution.context;
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

export async function redirectAuthenticatedUser(options?: { nextPath?: string }) {
  const resolution = await getServerAuthResolution();

  if (resolution.state !== "authenticated") {
    return;
  }

  if (resolution.context.profile.must_change_password) {
    redirect("/change-password");
  }

  redirect(options?.nextPath ?? "/");
}

export function canAccessUserManagement(role: UserRole) {
  return role === "admin" || role === "manager";
}
