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
  canViewParts: boolean;
  canManageParts: boolean;
  canViewLocations: boolean;
  canManageModels: boolean;
  canManageLocations: boolean;
  canViewModels: boolean;
  canAdjustStock: boolean;
  canViewReports: boolean;
  canPrintLabels: boolean;
  canExportReports: boolean;
  canImportCsv: boolean;
  canViewActivity: boolean;
  canManageUsers: boolean;
  canAccessSettings: boolean;
  canPreviewRoles: boolean;
  canViewUsers: boolean;
  canAccessSupport: boolean;
  canCreateSupportRequests: boolean;
  canCreateFeatureRequests: boolean;
  canModerateSupport: boolean;
  canManageSupportContent: boolean;
  canViewNotifications: boolean;
  canViewGreenMachines: boolean;
  canManageGreenMachines: boolean;
  canRecordGreenMachineEvents: boolean;
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
    description: "Can manage inventory data, stock, labels, activity, and reports for the team.",
  },
  {
    role: "technician",
    label: "Technician",
    description: "Can look up parts, manage stock, and work with inventory records on the floor.",
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
        canViewParts: true,
        canManageParts: true,
        canViewLocations: true,
        canManageModels: true,
        canManageLocations: true,
        canViewModels: true,
        canAdjustStock: true,
        canViewReports: true,
        canPrintLabels: true,
        canExportReports: true,
        canImportCsv: true,
        canViewActivity: true,
        canAccessSupport: true,
        canCreateSupportRequests: true,
        canCreateFeatureRequests: true,
        canModerateSupport: true,
        canManageSupportContent: true,
        canViewNotifications: true,
        canViewGreenMachines: true,
        canManageGreenMachines: true,
        canRecordGreenMachineEvents: true,
      };
    case "manager":
      return {
        canViewParts: true,
        canManageParts: true,
        canViewLocations: true,
        canManageModels: true,
        canManageLocations: true,
        canViewModels: true,
        canAdjustStock: true,
        canViewReports: true,
        canPrintLabels: true,
        canExportReports: true,
        canImportCsv: true,
        canViewActivity: true,
        canAccessSupport: true,
        canCreateSupportRequests: true,
        canCreateFeatureRequests: true,
        canModerateSupport: true,
        canManageSupportContent: false,
        canViewNotifications: true,
        canViewGreenMachines: true,
        canManageGreenMachines: true,
        canRecordGreenMachineEvents: true,
      };
    case "technician":
      return {
        canViewParts: true,
        canManageParts: true,
        canViewLocations: true,
        canManageModels: false,
        canManageLocations: false,
        canViewModels: true,
        canAdjustStock: true,
        canViewReports: false,
        canPrintLabels: false,
        canExportReports: false,
        canImportCsv: false,
        canViewActivity: false,
        canAccessSupport: true,
        canCreateSupportRequests: true,
        canCreateFeatureRequests: true,
        canModerateSupport: false,
        canManageSupportContent: false,
        canViewNotifications: true,
        canViewGreenMachines: true,
        canManageGreenMachines: false,
        canRecordGreenMachineEvents: true,
      };
    case "viewer":
    default:
      return {
        canViewParts: true,
        canManageParts: false,
        canViewLocations: true,
        canManageModels: false,
        canManageLocations: false,
        canViewModels: true,
        canAdjustStock: false,
        canViewReports: false,
        canPrintLabels: false,
        canExportReports: false,
        canImportCsv: false,
        canViewActivity: false,
        canAccessSupport: true,
        canCreateSupportRequests: true,
        canCreateFeatureRequests: true,
        canModerateSupport: false,
        canManageSupportContent: false,
        canViewNotifications: true,
        canViewGreenMachines: true,
        canManageGreenMachines: false,
        canRecordGreenMachineEvents: false,
      };
  }
}

export function resolvePermissions(context: RoleContext): PermissionSet {
  const base = getBasePermissions(context.effectiveRole);
  const canAccessAdminTools = context.effectiveRole === "admin";

  return {
    ...base,
    canManageUsers: canAccessAdminTools,
    canAccessSettings: canAccessAdminTools,
    canPreviewRoles: context.realRole === "admin",
    canViewUsers: canAccessAdminTools,
    canManageSupportContent: context.effectiveRole === "admin",
    canModerateSupport: context.effectiveRole === "admin" || context.effectiveRole === "manager",
    canManageGreenMachines:
      context.effectiveRole === "admin" || context.effectiveRole === "manager",
  };
}

export function getPermissions(role: UserRole): PermissionSet {
  return resolvePermissions({
    realRole: role,
    effectiveRole: role,
    isRolePreviewActive: false,
  });
}

export function canViewParts(role: UserRole) {
  return getBasePermissions(role).canViewParts;
}

export function canManageParts(role: UserRole) {
  return getBasePermissions(role).canManageParts;
}

export function canViewLocations(role: UserRole) {
  return getBasePermissions(role).canViewLocations;
}

export function canManageModels(role: UserRole) {
  return getBasePermissions(role).canManageModels;
}

export function canManageLocations(role: UserRole) {
  return getBasePermissions(role).canManageLocations;
}

export function canViewModels(role: UserRole) {
  return getBasePermissions(role).canViewModels;
}

export function canAdjustStock(role: UserRole) {
  return getBasePermissions(role).canAdjustStock;
}

export function canViewReports(role: UserRole) {
  return getBasePermissions(role).canViewReports;
}

export function canPrintLabels(role: UserRole) {
  return getBasePermissions(role).canPrintLabels;
}

export function canExportReports(role: UserRole) {
  return getBasePermissions(role).canExportReports;
}

export function canImportCsv(role: UserRole) {
  return getBasePermissions(role).canImportCsv;
}

export function canViewActivity(role: UserRole) {
  return getBasePermissions(role).canViewActivity;
}

export function canAccessSettings(role: UserRole) {
  return role === "admin";
}

export function canViewUsers(role: UserRole) {
  return role === "admin";
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
