"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpDown,
  ChevronRight,
  ClipboardList,
  DatabaseZap,
  History,
  Home,
  LayoutGrid,
  MapPinned,
  Menu,
  PackageSearch,
  QrCode,
  Settings2,
  ShieldCheck,
  Boxes,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useInventory } from "@/components/inventory-provider";
import type { ComponentType } from "react";

const primaryNav = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: PackageSearch },
  { href: "/lookup", label: "Lookup", icon: QrCode },
  { href: "/tags", label: "Tags", icon: ClipboardList },
];

const secondaryNav = [
  { href: "/locations", label: "Locations", icon: MapPinned },
  { href: "/models", label: "Models", icon: Boxes },
  { href: "/import-export", label: "Import / Export", icon: ArrowUpDown },
  { href: "/activity", label: "Activity", icon: History },
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
        "group flex items-center gap-3 rounded-xl border border-transparent transition-all",
        mobile
          ? "min-h-12 px-4 py-3 text-sm"
          : "min-h-11 px-3 py-2 text-sm",
        active
          ? "border-border bg-accent text-accent-foreground shadow-sm"
          : "text-muted-foreground hover:border-border hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="font-medium">{label}</span>
      {active && <ChevronRight className="ml-auto h-4 w-4" />}
    </Link>
  );
}

export function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { summary, resetDemoData, hydrated } = useInventory();

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.10),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.10),_transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(2,6,23,1))]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />

      <div className="relative mx-auto min-h-screen w-full max-w-[1900px] lg:grid lg:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-slate-950/70 px-5 py-6 backdrop-blur xl:flex xl:flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20">
                  <DatabaseZap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-wide text-white">
                    Novatech Inventory
                  </p>
                  <p className="text-xs text-slate-400">
                    Printer and copier parts
                  </p>
                </div>
              </div>
            </div>
            <Badge className="border-amber-400/40 bg-amber-400/15 text-amber-200">
              Phase 1
            </Badge>
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
            {secondaryNav.map((item) => (
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
                <p className="text-sm font-medium text-white">Browser store</p>
                <p className="text-xs text-slate-400">
                  Mock data persists locally until Phase 2.
                </p>
              </div>
              <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-200">
                {hydrated ? "Ready" : "Loading"}
              </Badge>
            </div>
            <Link
              href="/inventory?create=1"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "mt-4 h-10 w-full justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              Add a part
            </Link>
          </div>

          <div className="mt-auto pt-6">
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
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl xl:hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <Sheet>
                <SheetTrigger
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-100 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-4 w-4" />
                </SheetTrigger>
                <SheetContent side="left" className="border-white/10 bg-slate-950 text-white">
                  <SheetHeader className="p-4">
                    <SheetTitle className="text-white">Novatech Inventory</SheetTitle>
                    <SheetDescription className="text-slate-400">
                      Quick access to inventory, locations, tags, and settings.
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
                      {secondaryNav.map((item) => (
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
                  </ScrollArea>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Novatech
                </p>
                <h1 className="truncate text-base font-semibold text-white">
                  Printer and copier parts inventory
                </h1>
              </div>

              <Badge className="border-amber-400/40 bg-amber-400/15 text-amber-200">
                {summary.lowStockCount} low
              </Badge>
            </div>
          </header>

          <main className="min-w-0 flex-1 pb-24 lg:pb-8">{children}</main>

          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/92 px-2 py-2 backdrop-blur-xl xl:hidden">
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
                      Open the admin views and data tools.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-2 px-4 pb-4">
                    {secondaryNav.map((item) => (
                      <AppLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        pathname={pathname}
                        mobile
                      />
                    ))}
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
