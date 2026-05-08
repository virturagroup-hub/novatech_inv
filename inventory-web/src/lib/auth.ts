export type UserRole = "admin" | "manager" | "technician" | "viewer";

export type AuthBlockReason = "missing-profile" | "inactive";

export interface AuthSession {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  lastSignedInAt: string;
  active: boolean;
  mustChangePassword: boolean;
}

export interface PermissionSet {
  canManageParts: boolean;
  canManageModels: boolean;
  canManageLocations: boolean;
  canAdjustStock: boolean;
  canPrintLabels: boolean;
  canExportReports: boolean;
  canViewActivity: boolean;
  canViewUsers: boolean;
  canManageUsers: boolean;
  canPreviewRoles: boolean;
}

export interface RoleContext {
  realRole: UserRole;
  effectiveRole: UserRole;
  isRolePreviewActive: boolean;
}

export const roleOptions: Array<{
  role: UserRole;
  label: string;
  description: string;
}> = [
  {
    role: "admin",
    label: "Admin",
    description: "Full control over inventory, users, settings, and reports.",
  },
  {
    role: "manager",
    label: "Manager",
    description: "Can manage master data, labels, stock, and reports for the team.",
  },
  {
    role: "technician",
    label: "Technician",
    description: "Can look up parts, adjust stock, and print labels on the floor.",
  },
  {
    role: "viewer",
    label: "Viewer",
    description: "Read-only access for supervisors and occasional lookup users.",
  },
];

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "manager" || value === "technician" || value === "viewer";
}

export function getRoleLabel(role: UserRole) {
  return roleOptions.find((option) => option.role === role)?.label ?? role;
}

export function getRoleDescription(role: UserRole) {
  return roleOptions.find((option) => option.role === role)?.description ?? "";
}

function getBasePermissions(role: UserRole) {
  switch (role) {
    case "admin":
      return {
        canManageParts: true,
        canManageModels: true,
        canManageLocations: true,
        canAdjustStock: true,
        canPrintLabels: true,
        canExportReports: true,
        canViewActivity: true,
        canViewUsers: true,
      };
    case "manager":
      return {
        canManageParts: true,
        canManageModels: true,
        canManageLocations: true,
        canAdjustStock: true,
        canPrintLabels: true,
        canExportReports: true,
        canViewActivity: true,
        canViewUsers: true,
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
        canViewUsers: false,
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
        canViewUsers: false,
      };
  }
}

export function resolvePermissions(context: RoleContext): PermissionSet {
  const base = getBasePermissions(context.effectiveRole);

  return {
    ...base,
    canManageUsers: context.realRole === "admin",
    canPreviewRoles: context.realRole === "admin",
  };
}

export function getPermissions(role: UserRole): PermissionSet {
  return resolvePermissions({
    realRole: role,
    effectiveRole: role,
    isRolePreviewActive: false,
  });
}

export function canManageParts(role: UserRole) {
  return getBasePermissions(role).canManageParts;
}

export function canManageModels(role: UserRole) {
  return getBasePermissions(role).canManageModels;
}

export function canManageLocations(role: UserRole) {
  return getBasePermissions(role).canManageLocations;
}

export function canAdjustStock(role: UserRole) {
  return getBasePermissions(role).canAdjustStock;
}

export function canPrintLabels(role: UserRole) {
  return getBasePermissions(role).canPrintLabels;
}

export function canExportReports(role: UserRole) {
  return getBasePermissions(role).canExportReports;
}

export function canViewActivity(role: UserRole) {
  return getBasePermissions(role).canViewActivity;
}

export function canViewUsers(role: UserRole) {
  return getBasePermissions(role).canViewUsers;
}

export function canManageUsers(role: UserRole) {
  return role === "admin";
}

export function canPreviewRoles(role: UserRole) {
  return role === "admin";
}

export function isElevatedRole(role: UserRole) {
  return role === "admin" || role === "manager";
}

export function getAuthBlockMessage(reason: AuthBlockReason) {
  switch (reason) {
    case "missing-profile":
      return "Your account exists, but no app profile was found. Contact an admin.";
    case "inactive":
      return "This account is inactive. Contact an admin.";
  }
}
