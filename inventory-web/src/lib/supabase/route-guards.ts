import { redirect } from "next/navigation";

import type { AuthBlockReason, UserRole } from "@/lib/auth";
import { buildChangePasswordPath, buildLoginPath, sanitizeInternalPath } from "@/lib/navigation";

import { getServerAuthResolution } from "./session";

function loginRedirectPath(reason: AuthBlockReason | null, nextPath?: string) {
  return buildLoginPath({
    reason,
    nextPath,
  });
}

export async function requireAuthenticatedSession(options?: { nextPath?: string }) {
  const resolution = await getServerAuthResolution();

  if (resolution.state !== "authenticated") {
    redirect(loginRedirectPath(resolution.reason, options?.nextPath));
  }

  return resolution.context;
}

export async function requireAppSession(options?: { nextPath?: string }) {
  const context = await requireAuthenticatedSession(options);

  if (context.profile.must_change_password) {
    redirect(buildChangePasswordPath(options?.nextPath));
  }

  return context;
}

export async function requirePasswordChangeSession(options?: { nextPath?: string }) {
  const resolution = await getServerAuthResolution();

  if (resolution.state !== "authenticated") {
    redirect(loginRedirectPath(resolution.reason, options?.nextPath));
  }

  if (!resolution.context.profile.must_change_password) {
    redirect(sanitizeInternalPath(options?.nextPath));
  }

  return resolution.context;
}

export async function requireUserManagementSession(options?: { nextPath?: string }) {
  const context = await requireAppSession(options);

  if (!["admin", "manager"].includes(context.profile.role)) {
    redirect("/");
  }

  return context;
}

export async function requireAdminSession(options?: { nextPath?: string }) {
  const context = await requireAppSession(options);

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
    redirect(buildChangePasswordPath(options?.nextPath));
  }

  redirect(sanitizeInternalPath(options?.nextPath));
}

export function canAccessUserManagement(role: UserRole) {
  return role === "admin" || role === "manager";
}
