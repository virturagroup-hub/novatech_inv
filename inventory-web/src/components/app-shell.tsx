"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  FileClock,
  Home,
  LayoutGrid,
  MapPinned,
  Menu,
  PackageSearch,
  Printer,
  Users,
  Settings2,
  ShieldCheck,
  LogOut,
} from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useInventory } from "@/components/inventory-provider";
import { useAuth } from "@/components/auth-provider";
import { APP_NAME, APP_SUBTITLE } from "@/lib/brand";
import { getRoleLabel } from "@/lib/auth";
import type { ComponentType } from "react";

const primaryNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/lookup", label: "Lookup", icon: PackageSearch },
  { href: "/inventory", label: "Parts", icon: Boxes },
  { href: "/tags", label: "Labels", icon: Printer },
];

const secondaryNav = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/locations", label: "Locations", icon: MapPinned },
  { href: "/models", label: "Models", icon: Boxes },
  { href: "/import-export", label: "Reports / Exports", icon: ArrowUpRight },
  { href: "/activity", label: "Activity", icon: FileClock },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

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
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  pathname: string;
  mobile?: boolean;
}) {
  const active = isActiveRoute(pathname, href);

  return (
    <Link
      href={href}
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
  const { summary, resetDemoData } = useInventory();
  const { session, hydrated, isAuthenticated, permissions, signOut } = useAuth();
  const isPublicRoute =
    pathname === "/login" || pathname === "/change-password" || pathname.startsWith("/print");
  const isLogoutRoute = pathname === "/logout";
  const visibleSecondaryNav = permissions.canViewUsers
    ? secondaryNav
    : secondaryNav.filter((item) => item.href !== "/admin/users");

  useEffect(() => {
    if (!hydrated) return;

    if (isLogoutRoute) {
      void signOut().finally(() => router.replace("/login"));
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (session?.active === false) {
      void signOut().finally(() => router.replace("/login?reason=inactive"));
      return;
    }

    if (isAuthenticated && session?.mustChangePassword && pathname !== "/change-password") {
      router.replace("/change-password");
      return;
    }

    if (isAuthenticated && pathname === "/login") {
      router.replace(session?.mustChangePassword ? "/change-password" : "/");
      return;
    }

    if (pathname.startsWith("/admin/users") && !permissions.canViewUsers) {
      router.replace("/");
    }
  }, [
    hydrated,
    isAuthenticated,
    isLogoutRoute,
    isPublicRoute,
    pathname,
    permissions.canViewUsers,
    router,
    session?.active,
    session?.mustChangePassword,
    signOut,
  ]);

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
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:48px_48px] opacity-15" />

      <div className="relative mx-auto min-h-screen w-full max-w-[1920px] lg:grid lg:grid-cols-[312px_minmax(0,1fr)]">
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
                {getRoleLabel(session.role)}
              </Badge>
              <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-100">
                {permissions.canManageParts ? "Elevated" : "Restricted"}
              </Badge>
            </div>
          </div>

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
            {visibleSecondaryNav.map((item) => (
              <AppLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                pathname={pathname}
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
                <p className="text-xs text-slate-400">
                  Local data stays in the browser until Supabase is connected.
                </p>
              </div>
              <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-100">
                Ready
              </Badge>
            </div>
            <Link
              href="/inventory/new"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "mt-4 h-11 w-full justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <PackageSearch className="mr-2 h-4 w-4" />
              Add a part
            </Link>
          </div>

          <div className="mt-auto pt-6 space-y-2">
            {permissions.canManageParts && (
              <Button
                variant="outline"
                className="h-10 w-full justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  if (
                    window.confirm(
                      "Reset the browser-local demo inventory back to the Phase 1 seed data?",
                    )
                  ) {
                    resetDemoData();
                  }
                }}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Reset demo data
              </Button>
            )}
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
              <Sheet>
                <SheetTrigger
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-4 w-4" />
                </SheetTrigger>
                <SheetContent side="left" className="border-white/10 bg-slate-950 text-white">
                  <SheetHeader className="p-4">
                    <SheetTitle className="text-white">{APP_NAME}</SheetTitle>
                    <SheetDescription className="text-slate-400">
                      {APP_SUBTITLE}. Quick access to inventory, labels, and admin tools.
                    </SheetDescription>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-8rem)] px-4 pb-4">
                    <div className="space-y-2">
                      {primaryNav.map((item) => (
                        <AppLink
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          pathname={pathname}
                          mobile
                        />
                      ))}
                    </div>
                    <Separator className="my-4 bg-white/10" />
                    <div className="space-y-2">
                      {visibleSecondaryNav.map((item) => (
                        <AppLink
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          pathname={pathname}
                          mobile
                        />
                      ))}
                    </div>
                    <div className="mt-4 space-y-2">
                      {permissions.canManageParts && (
                        <Button
                          variant="outline"
                          className="h-11 w-full justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Reset the browser-local demo inventory back to the Phase 1 seed data?",
                              )
                            ) {
                              resetDemoData();
                            }
                          }}
                        >
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Reset demo data
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="h-11 w-full justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        onClick={() => {
                          signOut();
                          router.replace("/login");
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </Button>
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1">
                <BrandLockup compact />
              </div>

              <div className="flex items-center gap-2">
                <Badge className="border-white/10 bg-white/5 text-slate-200">
                  {getRoleLabel(session.role)}
                </Badge>
                <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-100">
                  {summary.lowStockCount} low
                </Badge>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 pb-24 lg:pb-8">{children}</main>

          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-2 py-2 backdrop-blur-xl lg:hidden">
            <div className="grid grid-cols-5 gap-1">
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

              <Sheet>
                <SheetTrigger
                  className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Open more navigation items"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="leading-none">More</span>
                </SheetTrigger>
                <SheetContent side="bottom" className="border-white/10 bg-slate-950 text-white">
                  <SheetHeader className="p-4">
                    <SheetTitle className="text-white">More sections</SheetTitle>
                    <SheetDescription className="text-slate-400">
                      Open locations, models, reports, activity, and settings.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-2 px-4 pb-4">
                    {visibleSecondaryNav.map((item) => (
                      <AppLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        pathname={pathname}
                        mobile
                      />
                    ))}
                    {permissions.canManageParts && (
                      <Button
                        variant="outline"
                        className="mt-2 h-11 justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Reset the browser-local demo inventory back to the Phase 1 seed data?",
                            )
                          ) {
                            resetDemoData();
                          }
                        }}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Reset demo data
                      </Button>
                    )}
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
