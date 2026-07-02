"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  Bell,
  FileClock,
  Home,
  LayoutGrid,
  MapPinned,
  Gauge,
  PackageSearch,
  Printer,
  MessagesSquare,
  Recycle,
  Users,
  Settings2,
  LogOut,
} from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import { RolePreviewPanel } from "@/components/role-preview-panel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useInventory } from "@/components/inventory-provider";
import { useAuth } from "@/components/auth-provider";
import { useWorkspaceContent } from "@/components/workspace-content-provider";
import { APP_NAME, APP_SUBTITLE } from "@/lib/brand";
import { getRoleLabel } from "@/lib/auth";
import {
  buildAccessDeniedPath,
  buildChangePasswordPath,
  buildLoginPath,
  sanitizeInternalPath,
} from "@/lib/navigation";
import type { ComponentType } from "react";

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AppLink({
  href,
  label,
  icon: Icon,
  pathname,
  mobile = false,
  onNavigate,
  badge,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  pathname: string;
  mobile?: boolean;
  onNavigate?: () => void;
  badge?: string | number | null;
}) {
  const active = isActiveRoute(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-transparent transition-all",
        mobile ? "min-h-12 px-4 py-3 text-sm" : "min-h-11 px-3 py-2 text-sm",
        active
          ? "border-emerald-400/20 bg-emerald-400/10 text-white shadow-sm"
          : "text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white",
      )}
      >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="font-medium">{label}</span>
      {badge !== null && badge !== undefined && (
        <Badge className="ml-auto border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.18em] text-slate-200">
          {badge}
        </Badge>
      )}
      {active && <ChevronRight className="ml-auto h-4 w-4" />}
    </Link>
  );
}

function ShellRedirectState({
  title,
  subtitle,
}: Readonly<{
  title: string;
  subtitle: string;
}>) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-6 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
        <BrandLockup className="justify-center" />
        <h2 className="mt-6 text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{subtitle}</p>
      </div>
    </div>
  );
}

export function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const { summary, refreshInventory, isSupabaseMode } = useInventory();
  const { unreadNotificationCount } = useWorkspaceContent();
  const {
    session,
    hydrated,
    isAuthenticated,
    permissions,
    realRole,
    effectiveRole,
    isRolePreviewActive,
    authIssue,
    clearRolePreview,
    signOut,
  } = useAuth();
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/change-password" ||
    pathname === "/access-denied" ||
    pathname.startsWith("/print");
  const isLogoutRoute = pathname === "/logout";
  const primaryNav = [
    { href: "/", label: "Home", icon: Home, visible: true },
    { href: "/lookup", label: "Lookup", icon: PackageSearch, visible: permissions.canViewParts },
    { href: "/inventory", label: "Parts", icon: Boxes, visible: permissions.canViewParts },
    { href: "/tags", label: "Labels", icon: Printer, visible: permissions.canPrintLabels },
  ].filter((item) => item.visible);

  const secondaryNav = [
    {
      href: "/support",
      label: "Support",
      icon: MessagesSquare,
      visible: permissions.canAccessSupport,
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : null,
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: Bell,
      visible: permissions.canViewNotifications,
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : null,
    },
    {
      href: "/green-machines",
      label: "Green Machines",
      icon: Recycle,
      visible: permissions.canViewGreenMachines,
    },
    { href: "/admin/users", label: "Users", icon: Users, visible: effectiveRole === "admin" },
    { href: "/admin/health", label: "Health", icon: Gauge, visible: permissions.canAccessSettings },
    { href: "/locations", label: "Locations", icon: MapPinned, visible: permissions.canViewLocations },
    { href: "/models", label: "Models", icon: Boxes, visible: permissions.canViewModels },
    {
      href: "/import-export",
      label: "Reports / Exports",
      icon: ArrowUpRight,
      visible: permissions.canViewReports,
    },
    { href: "/activity", label: "Activity", icon: FileClock, visible: permissions.canViewActivity },
    { href: "/settings", label: "Settings", icon: Settings2, visible: effectiveRole === "admin" },
  ].filter((item) => item.visible);

  useEffect(() => {
    if (!hydrated) return;

    const currentPath = typeof window !== "undefined"
      ? sanitizeInternalPath(`${window.location.pathname}${window.location.search}`)
      : sanitizeInternalPath(pathname);

    if (isLogoutRoute) {
      void signOut().finally(() => router.replace("/login"));
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      router.replace(
        authIssue
          ? buildLoginPath({ reason: authIssue, nextPath: currentPath })
          : buildLoginPath({ nextPath: currentPath }),
      );
      return;
    }

    if (isAuthenticated && session?.mustChangePassword && pathname !== "/change-password") {
      router.replace(buildChangePasswordPath(currentPath));
      return;
    }

    if (isAuthenticated && pathname === "/login") {
      router.replace(session?.mustChangePassword ? buildChangePasswordPath(currentPath) : "/");
      return;
    }

    if (pathname.startsWith("/admin/users") && effectiveRole !== "admin") {
      router.replace(buildAccessDeniedPath({ nextPath: currentPath, reason: "users" }));
      return;
    }

    if (pathname.startsWith("/settings") && effectiveRole !== "admin") {
      router.replace(buildAccessDeniedPath({ nextPath: currentPath, reason: "settings" }));
      return;
    }

    if (pathname.startsWith("/activity") && !permissions.canViewActivity) {
      router.replace(buildAccessDeniedPath({ nextPath: currentPath, reason: "activity" }));
      return;
    }

    if (
      (pathname.startsWith("/import-export") || pathname.startsWith("/reports")) &&
      !permissions.canViewReports
    ) {
      router.replace(buildAccessDeniedPath({ nextPath: currentPath, reason: "reports" }));
      return;
    }

    if ((pathname.startsWith("/tags") || pathname.startsWith("/print")) && !permissions.canPrintLabels) {
      router.replace(buildAccessDeniedPath({ nextPath: currentPath, reason: "labels" }));
      return;
    }

    if (
      (pathname.startsWith("/inventory/new") || pathname.match(/^\/inventory\/[^/]+\/edit\/?$/)) &&
      !permissions.canManageParts
    ) {
      router.replace(buildAccessDeniedPath({ nextPath: currentPath, reason: "parts" }));
      return;
    }

    if (
      (pathname.startsWith("/locations/new") || pathname.match(/^\/locations\/[^/]+\/edit\/?$/)) &&
      !permissions.canManageLocations
    ) {
      router.replace(buildAccessDeniedPath({ nextPath: currentPath, reason: "locations" }));
      return;
    }

    if (
      (pathname.startsWith("/models/new") || pathname.match(/^\/models\/[^/]+\/edit\/?$/)) &&
      !permissions.canManageModels
    ) {
      router.replace(buildAccessDeniedPath({ nextPath: currentPath, reason: "models" }));
      return;
    }
  }, [
    authIssue,
    hydrated,
    isAuthenticated,
    isLogoutRoute,
    isPublicRoute,
    pathname,
    permissions.canAccessSettings,
    permissions.canManageLocations,
    permissions.canManageModels,
    permissions.canManageParts,
    permissions.canManageUsers,
    permissions.canPrintLabels,
    permissions.canViewActivity,
    permissions.canViewModels,
    permissions.canViewParts,
    permissions.canViewReports,
    permissions.canViewLocations,
    effectiveRole,
    router,
    session?.mustChangePassword,
    signOut,
  ]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || session?.mustChangePassword || !isSupabaseMode) {
      return;
    }

    // On fresh devices or browsers, the auth session can become available a moment
    // before the server-side snapshot route can read it. Refresh once auth is ready
    // so live Supabase data wins over any stale empty state.
    void refreshInventory();
  }, [hydrated, isAuthenticated, isSupabaseMode, refreshInventory, session?.mustChangePassword]);

  if (!hydrated && !isPublicRoute) {
    return (
      <ShellRedirectState
        title={`Loading ${APP_NAME}`}
        subtitle={`Preparing ${APP_SUBTITLE.toLowerCase()} and your session...`}
      />
    );
  }

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return (
      <ShellRedirectState
        title="Signing you in"
        subtitle="Hold on while we open the workspace."
      />
    );
  }

  if (!session) {
    return (
      <ShellRedirectState
        title={`Loading ${APP_NAME}`}
        subtitle="Restoring your session..."
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.10),_transparent_30%),linear-gradient(180deg,#030712_0%,#020617_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:48px_48px] opacity-15" />

      <div className="relative z-10 mx-auto min-h-screen w-full max-w-[1920px] lg:grid lg:grid-cols-[312px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-slate-950/75 px-5 py-6 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex items-start justify-between gap-3">
            <BrandLockup />
            <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-100">
              Live
            </Badge>
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Current session
            </p>
            <p className="mt-2 truncate text-sm font-semibold text-white">
              {session.displayName}
            </p>
            <p className="mt-1 text-xs text-slate-400">{session.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="border-white/10 bg-white/5 text-slate-200">
                {getRoleLabel(realRole ?? session.role)}
              </Badge>
              {isRolePreviewActive && (
                <Badge className="border-amber-400/30 bg-amber-400/15 text-amber-100">
                  Preview: {getRoleLabel(effectiveRole)}
                </Badge>
              )}
              <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-100">
                {permissions.canManageParts ? "Elevated" : "Restricted"}
              </Badge>
            </div>
          </div>

          {permissions.canPreviewRoles && (
            <div className="mt-4">
              <RolePreviewPanel compact />
            </div>
          )}

          <div className="mt-6 space-y-2">
            {primaryNav.map((item) => (
              <AppLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                pathname={pathname}
              />
            ))}
          </div>

          <Separator className="my-6 bg-white/10" />

          <div className="space-y-2">
            {secondaryNav.map((item) => (
              <AppLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                pathname={pathname}
                badge={item.badge}
              />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Units on hand
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {summary.totalUnits}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Low stock
              </p>
              <p className="mt-2 text-2xl font-semibold text-amber-300">
                {summary.lowStockCount}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Coverage
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">
                {summary.coverage}%
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Attention
              </p>
              <p className="mt-2 text-2xl font-semibold text-rose-300">
                {summary.attentionCount}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">Workspace tools</p>
                <p className="text-xs text-slate-400">Quick access to common inventory tasks.</p>
              </div>
              <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-100">
                Ready
              </Badge>
            </div>
            <div className="mt-4 grid gap-2">
              <Link
                href="/inventory/new"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "h-11 w-full justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <PackageSearch className="mr-2 h-4 w-4" />
                Add a part
              </Link>
              {permissions.canAccessSettings && (
                <Link
                  href="/admin/health"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "h-11 w-full justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Gauge className="mr-2 h-4 w-4" />
                  Health dashboard
                </Link>
              )}
            </div>
          </div>

          <div className="mt-auto pt-6 space-y-2">
            <Button
              variant="outline"
              className="h-10 w-full justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => {
                signOut();
                router.replace("/login");
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl lg:hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <BrandLockup compact />
              </div>

              <div className="flex items-center gap-2">
                <Badge className="border-white/10 bg-white/5 text-slate-200">
                  {getRoleLabel(realRole ?? session.role)}
                </Badge>
                {isRolePreviewActive && (
                  <Badge className="border-amber-400/30 bg-amber-400/15 text-amber-100">
                    {getRoleLabel(effectiveRole)}
                  </Badge>
                )}
                <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-100">
                  {summary.lowStockCount} low
                </Badge>
              </div>
            </div>
          </header>

          {isRolePreviewActive && (
            <div className="mx-4 mt-4 rounded-3xl border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-amber-50 shadow-lg shadow-amber-950/10 lg:mx-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    Viewing as {getRoleLabel(effectiveRole)}
                  </p>
                  <p className="text-xs leading-5 text-amber-100/90">
                    Your real account is {getRoleLabel(realRole ?? session.role)}. This preview only changes the interface, not your server-side permissions.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="h-10 border-amber-200/30 bg-white/10 text-amber-50 hover:bg-white/20 hover:text-white"
                  onClick={clearRolePreview}
                >
                  Return to Admin
                </Button>
              </div>
            </div>
          )}

          <main className="min-w-0 flex-1 pb-24 lg:pb-8">{children}</main>

          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-2 py-2 backdrop-blur-xl lg:hidden">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${primaryNav.length + 1}, minmax(0, 1fr))` }}
            >
              {primaryNav.map((item) => {
                const Icon = item.icon;
                const active = isActiveRoute(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-medium transition-colors",
                      active
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="leading-none">{item.label}</span>
                  </Link>
                );
              })}

              <Sheet key={pathname}>
                <SheetTrigger
                  className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Open more navigation items"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="leading-none">More</span>
                </SheetTrigger>
                <SheetContent
                  side="bottom"
                  showCloseButton={false}
                  className="max-h-[calc(100dvh-1rem)] overflow-y-auto border-white/10 bg-slate-950 text-white"
                >
                  <SheetHeader className="flex-row items-start justify-between gap-4 px-4 pb-0 pt-4">
                    <div className="space-y-1">
                      <SheetTitle className="text-white">More sections</SheetTitle>
                      <SheetDescription className="text-slate-400">
                        Open support, notifications, green machines, locations, models, reports, activity, health, and settings.
                      </SheetDescription>
                    </div>
                    <SheetClose
                      render={
                        <Button
                          variant="outline"
                          size="default"
                          className="h-10 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        >
                        </Button>
                      }
                    >
                      Close
                    </SheetClose>
                  </SheetHeader>
                  <div className="grid gap-2 px-4 pb-4 pt-4">
                    {permissions.canPreviewRoles && (
                      <RolePreviewPanel compact className="mb-2" />
                    )}
                    {secondaryNav.map((item) => (
                      <AppLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        pathname={pathname}
                        mobile
                        badge={item.badge}
                      />
                    ))}
                    <Button
                      variant="outline"
                      className="mt-2 h-11 justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                      onClick={() => {
                        signOut();
                        router.replace("/login");
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
