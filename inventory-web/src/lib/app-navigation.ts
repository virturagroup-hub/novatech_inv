import type { ComponentType } from "react";
import {
  ArrowUpRight,
  Bell,
  Boxes,
  FileClock,
  Gauge,
  Home,
  MapPinned,
  MessageSquareMore,
  MessagesSquare,
  PackageSearch,
  Printer,
  RefreshCw,
  Recycle,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";

import type { PermissionSet, UserRole } from "./auth";

export const appRoutes = {
  home: "/",
  lookup: "/lookup",
  parts: "/inventory",
  machines: "/green-machines",
  labels: "/tags",
  support: "/support",
  forum: "/forum",
  featureRequests: "/feature-requests",
  updates: "/updates",
  notifications: "/notifications",
  users: "/admin/users",
  health: "/admin/health",
  locations: "/locations",
  models: "/models",
  reports: "/import-export",
  activity: "/activity",
  settings: "/settings",
} as const;

export interface AppNavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string | number | null;
}

export interface AppNavigationContext {
  permissions: PermissionSet;
  effectiveRole: UserRole;
  supportQueueCount: number;
  featureRequestQueueCount: number;
  unreadNotificationCount: number;
}

function navItem(
  item: AppNavItem,
  visible: boolean,
): AppNavItem | null {
  return visible ? item : null;
}

export function buildAppNavigation({
  permissions,
  effectiveRole,
  supportQueueCount,
  featureRequestQueueCount,
  unreadNotificationCount,
}: AppNavigationContext) {
  const supportBadge =
    permissions.canModerateSupport && supportQueueCount > 0 ? supportQueueCount : null;
  const featureRequestBadge =
    permissions.canModerateSupport && featureRequestQueueCount > 0 ? featureRequestQueueCount : null;
  const notificationBadge =
    permissions.canViewNotifications && unreadNotificationCount > 0 ? unreadNotificationCount : null;

  const desktopPrimaryNav = [
    navItem({ href: appRoutes.home, label: "Home", icon: Home }, true),
    navItem({ href: appRoutes.lookup, label: "Lookup", icon: PackageSearch }, permissions.canViewParts),
    navItem({ href: appRoutes.parts, label: "Parts", icon: Boxes }, permissions.canViewParts),
    navItem({ href: appRoutes.machines, label: "Machines", icon: Recycle }, permissions.canViewGreenMachines),
    navItem({ href: appRoutes.labels, label: "Labels", icon: Printer }, permissions.canPrintLabels),
  ].filter(Boolean) as AppNavItem[];

  const desktopSecondaryNav = [
    navItem({ href: appRoutes.support, label: "Support", icon: MessagesSquare, badge: supportBadge }, permissions.canAccessSupport),
    navItem({ href: appRoutes.forum, label: "Forum", icon: MessageSquareMore }, true),
    navItem(
      { href: appRoutes.featureRequests, label: "Feature Requests", icon: Sparkles, badge: featureRequestBadge },
      permissions.canCreateFeatureRequests,
    ),
    navItem({ href: appRoutes.updates, label: "Updates", icon: RefreshCw }, true),
    navItem({ href: appRoutes.notifications, label: "Notifications", icon: Bell, badge: notificationBadge }, permissions.canViewNotifications),
    navItem({ href: appRoutes.users, label: "Users", icon: Users }, effectiveRole === "admin"),
    navItem({ href: appRoutes.health, label: "Health", icon: Gauge }, permissions.canAccessSettings),
    navItem({ href: appRoutes.locations, label: "Locations", icon: MapPinned }, permissions.canViewLocations),
    navItem({ href: appRoutes.models, label: "Models", icon: Boxes }, permissions.canViewModels),
    navItem({ href: appRoutes.reports, label: "Reports / Exports", icon: ArrowUpRight }, permissions.canViewReports),
    navItem({ href: appRoutes.activity, label: "Activity", icon: FileClock }, permissions.canViewActivity),
    navItem({ href: appRoutes.settings, label: "Settings", icon: Settings2 }, effectiveRole === "admin"),
  ].filter(Boolean) as AppNavItem[];

  const mobilePrimaryNav = desktopPrimaryNav.filter((item) => item.href !== appRoutes.labels);

  const mobileMenuNav = [
    navItem({ href: appRoutes.labels, label: "Labels", icon: Printer }, permissions.canPrintLabels),
    ...desktopSecondaryNav,
  ].filter(Boolean) as AppNavItem[];

  return {
    desktopPrimaryNav,
    desktopSecondaryNav,
    mobilePrimaryNav,
    mobileMenuNav,
  };
}
