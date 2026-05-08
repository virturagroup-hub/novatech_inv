"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  ClipboardList,
  PackageSearch,
  QrCode,
  Truck,
  AlertTriangle,
  Gauge,
  Layers3,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatCompactDate,
  getBinSummary,
  getPartLocationLabel,
  getPartStockStatus,
  requiresAttention,
} from "@/lib/inventory-utils";

export function DashboardPage() {
  const { permissions } = useAuth();
  const {
    bins,
    parts,
    summary,
    getCompatibleModels,
  } = useInventory();

  const topBins = [...bins]
    .map((bin) => ({
      bin,
      ...getBinSummary(bin, parts),
    }))
    .sort((left, right) => right.totalUnits - left.totalUnits)
    .slice(0, 5);

  const manufacturerTotals = summary.manufacturers.slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Inventory command center"
        title="Keep the parts room moving without guessing."
        description="Track parts, bins, model compatibility, and reorder pressure from one responsive dashboard. The current build uses typed mock data and browser-local persistence so the workflows are ready for a Phase 2 Supabase handoff."
        actions={
          <>
            <Link
              href="/inventory"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              Inventory
            </Link>
            <Link
              href="/tags"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              Print tags
            </Link>
            <Link
              href="/import-export"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-amber-400 text-slate-950 hover:bg-amber-300",
              )}
            >
              CSV tools
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Units on hand"
          value={summary.totalUnits}
          hint="Across all active parts"
          icon={<Truck className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="Low stock"
          value={summary.lowStockCount}
          hint="At or under reorder point"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Parts needing attention"
          value={summary.attentionCount}
          hint="Unassigned or missing compatibility"
          icon={<Gauge className="h-5 w-5" />}
          tone="rose"
        />
        <StatCard
          label="Coverage"
          value={`${summary.coverage}%`}
          hint="Compatible or universal parts"
          icon={<Layers3 className="h-5 w-5" />}
          tone="emerald"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-white">Low-stock watchlist</CardTitle>
                <CardDescription className="text-slate-400">
                  Parts that need a reorder or count review before they create a service delay.
                </CardDescription>
              </div>
              <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-200">
                {summary.lowStockCount} items
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.lowStockTable.map((part) => {
                const binLabel = getPartLocationLabel(part, bins);
                const stockStatus = getPartStockStatus(part);
                const compatCount = getCompatibleModels(part).length;

                return (
                  <Link
                    key={part.id}
                    href={`/inventory/${part.id}`}
                    className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition-colors hover:border-amber-400/30 hover:bg-slate-950/80 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-semibold text-white">
                          {part.partNumber}
                        </p>
                        <Badge
                          className={cn(
                            "border",
                            stockStatus === "critical"
                              ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                              : "border-amber-400/20 bg-amber-400/10 text-amber-200",
                          )}
                        >
                          {stockStatus === "critical" ? "Critical" : "Low"}
                        </Badge>
                        {requiresAttention(part) && (
                          <Badge className="border-white/10 bg-white/5 text-slate-200">
                            Attention
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-slate-200">
                        {part.partName}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {binLabel} · {compatCount} compatible models
                      </p>
                    </div>
                    <div className="grid min-w-[180px] grid-cols-3 gap-3 text-right">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                          Qty
                        </p>
                        <p className="mt-1 text-xl font-semibold text-white">
                          {part.quantityOnHand}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                          Reorder
                        </p>
                        <p className="mt-1 text-xl font-semibold text-slate-200">
                          {part.reorderPoint}
                        </p>
                      </div>
                      <div className="flex items-center justify-end">
                        <ArrowUpRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                    </div>
                  </Link>
                );
              })}

              {summary.lowStockTable.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                  No low-stock items at the moment.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Location health</CardTitle>
                <CardDescription className="text-slate-400">
                  Bin utilization and review pressure across the storage map.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topBins.map(({ bin, parts: binParts, totalUnits, lowStockCount }) => (
                  <div
                    key={bin.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {bin.code} · {bin.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {bin.manufacturer || "General"} · {bin.description}
                        </p>
                      </div>
                      <Badge className="border-white/10 bg-white/5 text-slate-200">
                        {binParts.length} parts
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-white/5">
                        <div
                          className="h-2 rounded-full bg-amber-400/80"
                          style={{
                            width: `${Math.min(100, Math.max(12, totalUnits * 2.5))}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">
                        {lowStockCount} low
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Manufacturer mix</CardTitle>
                <CardDescription className="text-slate-400">
                  Which vendors are carrying the most inventory volume right now.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {manufacturerTotals.map((item) => (
                  <div key={item.label} className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="text-xs text-slate-400">
                          {item.parts} parts · {item.attention} need review
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-200">{item.units} units</p>
                    </div>
                    <div className="h-2 rounded-full bg-white/5">
                      <div
                        className="h-2 rounded-full bg-sky-400/80"
                        style={{ width: `${Math.min(100, (item.units / Math.max(summary.totalUnits, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          {permissions.canViewActivity ? (
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Recent activity</CardTitle>
                <CardDescription className="text-slate-400">
                  Local audit trail from this Phase 1 browser store.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary.recentActivity.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Badge
                        className={cn(
                          "border",
                          entry.tone === "danger"
                            ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                            : entry.tone === "warning"
                              ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                              : entry.tone === "success"
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                : "border-sky-400/20 bg-sky-400/10 text-sky-200",
                        )}
                      >
                        {entry.action}
                      </Badge>
                      <span className="font-mono text-[11px] text-slate-500">
                        {formatCompactDate(entry.occurredAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {entry.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {entry.detail}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Recent activity</CardTitle>
                <CardDescription className="text-slate-400">
                  Activity is hidden for read-only users.
                </CardDescription>
              </CardHeader>
              <CardContent className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
                View the lookup or inventory screens for read-only work. Technicians, managers, and admins can see the audit trail.
              </CardContent>
            </Card>
          )}

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Quick actions</CardTitle>
              <CardDescription className="text-slate-400">
                The most common internal workflows are one tap away.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <Link
                href="/inventory?create=1"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "h-11 justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <PackageSearch className="mr-2 h-4 w-4" />
                Add a part
              </Link>
              <Link
                href="/lookup"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "h-11 justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Lookup bin / part
              </Link>
              <Link
                href="/tags"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "h-11 justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                Print labels
              </Link>
              <Link
                href="/locations"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "h-11 justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <Boxes className="mr-2 h-4 w-4" />
                Inspect bins
              </Link>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Phase 2 ready</CardTitle>
              <CardDescription className="text-slate-400">
                The current mock store is typed, local-first, and ready to map onto Supabase tables.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                Browser-local persistence keeps the Phase 1 workflows usable across refreshes.
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                Inventory, bins, and models already use stable ids instead of fragile name-only references.
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                Supabase can slot into the repository layer later without rewriting the dashboard UI.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
