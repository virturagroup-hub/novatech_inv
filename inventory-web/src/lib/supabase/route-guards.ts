import { redirect } from "next/navigation";

import type { AuthBlockReason, UserRole } from "@/lib/auth";
import {
  buildAccessDeniedPath,
  buildChangePasswordPath,
  buildLoginPath,
  sanitizeInternalPath,
} from "@/lib/navigation";

import { getServerAuthResolution } from "./session";

function loginRedirectPath(reason: AuthBlockReason | null, nextPath?: string) {
  return buildLoginPath({
    reason,
    nextPath,
  });
}

function accessDeniedPath(nextPath?: string, reason?: string) {
  return buildAccessDeniedPath({
    nextPath,
    reason,
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

  if (context.mustChangePassword) {
    redirect(buildChangePasswordPath(options?.nextPath));
  }

  return context;
}

export async function requirePasswordChangeSession(options?: { nextPath?: string }) {
  const resolution = await getServerAuthResolution();

  if (resolution.state !== "authenticated") {
    redirect(loginRedirectPath(resolution.reason, options?.nextPath));
  }

  if (!resolution.context.mustChangePassword) {
    redirect(sanitizeInternalPath(options?.nextPath));
  }

  return resolution.context;
}

export async function requireUserManagementSession(options?: { nextPath?: string }) {
  const context = await requireAppSession(options);

  if (context.profile.role !== "admin") {
    redirect(accessDeniedPath(options?.nextPath, "users"));
  }

  return context;
}

export async function requireAdminSession(options?: { nextPath?: string }) {
  const context = await requireAppSession(options);

  if (context.profile.role !== "admin") {
    redirect(accessDeniedPath(options?.nextPath, "admin"));
  }

  return context;
}

export async function requireManagePartsSession(options?: { nextPath?: string }) {
  const context = await requireAppSession(options);

  if (!["admin", "manager", "technician"].includes(context.profile.role)) {
    redirect(accessDeniedPath(options?.nextPath, "parts"));
  }

  return context;
}

export async function requireManageLocationsSession(options?: { nextPath?: string }) {
  const context = await requireAppSession(options);

  if (!["admin", "manager"].includes(context.profile.role)) {
    redirect(accessDeniedPath(options?.nextPath, "locations"));
  }

  return context;
}

export async function requireManageModelsSession(options?: { nextPath?: string }) {
  const context = await requireAppSession(options);

  if (!["admin", "manager"].includes(context.profile.role)) {
    redirect(accessDeniedPath(options?.nextPath, "models"));
  }

  return context;
}

export async function requireReportsSession(options?: { nextPath?: string }) {
  const context = await requireAppSession(options);

  if (!["admin", "manager"].includes(context.profile.role)) {
    redirect(accessDeniedPath(options?.nextPath, "reports"));
  }

  return context;
}

export async function requirePrintLabelsSession(options?: { nextPath?: string }) {
  const context = await requireAppSession(options);

  if (!["admin", "manager"].includes(context.profile.role)) {
    redirect(accessDeniedPath(options?.nextPath, "labels"));
  }

  return context;
}

export async function requireActivitySession(options?: { nextPath?: string }) {
  const context = await requireAppSession(options);

  if (!["admin", "manager"].includes(context.profile.role)) {
    redirect(accessDeniedPath(options?.nextPath, "activity"));
  }

  return context;
}

export async function requireAccessSettingsSession(options?: { nextPath?: string }) {
  const context = await requireAppSession(options);

  if (context.profile.role !== "admin") {
    redirect(accessDeniedPath(options?.nextPath, "settings"));
  }

  return context;
}

export async function redirectAuthenticatedUser(options?: { nextPath?: string }) {
  const resolution = await getServerAuthResolution();

  if (resolution.state !== "authenticated") {
    return;
  }

  if (resolution.context.mustChangePassword) {
    redirect(buildChangePasswordPath(options?.nextPath));
  }

  redirect(sanitizeInternalPath(options?.nextPath));
}

export function canAccessUserManagement(role: UserRole) {
  return role === "admin";
}
