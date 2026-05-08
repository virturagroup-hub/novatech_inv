export type UserRole = "admin" | "manager" | "technician" | "viewer";

export interface AuthSession {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  provider: "local-demo" | "supabase";
  lastSignedInAt: string;
}

export interface PermissionSet {
  canManageParts: boolean;
  canManageModels: boolean;
  canManageLocations: boolean;
  canAdjustStock: boolean;
  canPrintLabels: boolean;
  canExportReports: boolean;
  canViewActivity: boolean;
}

export const roleOptions: Array<{
  role: UserRole;
  label: string;
  description: string;
}> = [
  {
    role: "admin",
    label: "Admin",
    description: "Full control over inventory, models, locations, reports, and settings.",
  },
  {
    role: "manager",
    label: "Manager",
    description: "Can manage master data, stock, labels, and reports for the team.",
  },
  {
    role: "technician",
    label: "Technician",
    description: "Read inventory, adjust stock, and print labels while on the floor.",
  },
  {
    role: "viewer",
    label: "Viewer",
    description: "Read-only access for supervisors and occasional lookup users.",
  },
];

export function getRoleLabel(role: UserRole) {
  return roleOptions.find((option) => option.role === role)?.label ?? role;
}

export function getRoleDescription(role: UserRole) {
  return roleOptions.find((option) => option.role === role)?.description ?? "";
}

export function getPermissions(role: UserRole): PermissionSet {
  switch (role) {
    case "admin":
    case "manager":
      return {
        canManageParts: true,
        canManageModels: true,
        canManageLocations: true,
        canAdjustStock: true,
        canPrintLabels: true,
        canExportReports: true,
        canViewActivity: true,
      };
    case "technician":
      return {
        canManageParts: false,
        canManageModels: false,
        canManageLocations: false,
        canAdjustStock: true,
        canPrintLabels: true,
        canExportReports: false,
        canViewActivity: true,
      };
    case "viewer":
    default:
      return {
        canManageParts: false,
        canManageModels: false,
        canManageLocations: false,
        canAdjustStock: false,
        canPrintLabels: false,
        canExportReports: false,
        canViewActivity: false,
      };
  }
}

export function canManageParts(role: UserRole) {
  return getPermissions(role).canManageParts;
}

export function canManageModels(role: UserRole) {
  return getPermissions(role).canManageModels;
}

export function canManageLocations(role: UserRole) {
  return getPermissions(role).canManageLocations;
}

export function canAdjustStock(role: UserRole) {
  return getPermissions(role).canAdjustStock;
}

export function canPrintLabels(role: UserRole) {
  return getPermissions(role).canPrintLabels;
}

export function canExportReports(role: UserRole) {
  return getPermissions(role).canExportReports;
}

export function canViewActivity(role: UserRole) {
  return getPermissions(role).canViewActivity;
}

export function isElevatedRole(role: UserRole) {
  return role === "admin" || role === "manager";
}

export function createSession(profile: Omit<AuthSession, "id" | "lastSignedInAt" | "provider"> & {
  provider?: AuthSession["provider"];
}) {
  return {
    id: crypto.randomUUID(),
    lastSignedInAt: new Date().toISOString(),
    provider: profile.provider ?? "local-demo",
    ...profile,
  } satisfies AuthSession;
}

