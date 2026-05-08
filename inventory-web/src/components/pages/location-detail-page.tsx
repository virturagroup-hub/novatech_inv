"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  Edit3,
  MapPin,
  Printer,
  ScanSearch,
  Tag,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getBinStatusLabel, getBinSummary, getPartStockStatus } from "@/lib/inventory-utils";
import { buildBinPrintHref } from "@/lib/labels";

export function LocationDetailPage({ binId }: Readonly<{ binId: string }>) {
  const { permissions } = useAuth();
  const { parts, getBinById } = useInventory();

  const bin = getBinById(binId);

  if (!bin) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <PageHero
          eyebrow="Location detail"
          title="That location is not in the current inventory."
          description="The local browser store did not find a matching location. Go back to the location list or scan another label."
          actions={
            <>
              <Link
                href="/locations"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to locations
              </Link>
              <Link
                href="/lookup"
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
                )}
              >
                <ScanSearch className="mr-2 h-4 w-4" />
                Lookup parts
              </Link>
            </>
          }
        />
      </div>
    );
  }

  const summary = getBinSummary(bin, parts);
  const lowStockParts = summary.parts.filter((part) => getPartStockStatus(part) !== "healthy");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Location detail"
        title={`${bin.code} · ${bin.name}`}
        description={`${bin.aisle}-${bin.row}-${bin.column}. ${bin.description}`}
        actions={
          <>
            <Link
              href="/locations"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Locations
            </Link>
            {permissions.canPrintLabels && (
              <Link
                href={buildBinPrintHref({ binId: bin.id })}
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print bin label
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Parts in bin"
          value={summary.parts.length}
          hint="Assigned parts"
          icon={<Boxes className="h-5 w-5" />}
        />
        <StatCard
          label="Total units"
          value={summary.totalUnits}
          hint="Quantity on hand"
          icon={<Tag className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Low stock"
          value={lowStockParts.length}
          hint="Needs attention"
          icon={<MapPin className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Status"
          value={getBinStatusLabel(bin)}
          hint="Archive state"
          icon={<CalendarClock className="h-5 w-5" />}
          tone="sky"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/10 bg-white/5 text-slate-200">
                {getBinStatusLabel(bin)}
              </Badge>
              {bin.manufacturer && (
                <Badge className="border-white/10 bg-white/5 text-slate-200">
                  {bin.manufacturer}
                </Badge>
              )}
            </div>
            <CardTitle className="text-white">Location details</CardTitle>
            <CardDescription className="text-slate-400">
              Use this page for scan results and quick bin review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Location code</p>
                <p className="mt-2 text-lg font-semibold text-white">{bin.code}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {bin.aisle}-{bin.row}-{bin.column}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Description</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{bin.description}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Area</p>
                <p className="mt-2 text-sm text-slate-100">{bin.aisle}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Shelf</p>
                <p className="mt-2 text-sm text-slate-100">{bin.row}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Bin</p>
                <p className="mt-2 text-sm text-slate-100">{bin.column}</p>
              </div>
            </div>

            <div className="space-y-2 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-sm font-semibold text-white">Notes</p>
              <p className="text-sm leading-6 text-slate-300">
                {bin.notes || "No notes on file for this location."}
              </p>
            </div>

            <Separator className="bg-white/10" />

            <div className="flex flex-wrap gap-2">
              {permissions.canManageLocations && (
                <Link
                  href="/locations"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  Manage locations
                </Link>
              )}
              {permissions.canPrintLabels && (
                <Link
                  href={buildBinPrintHref({ binId: bin.id })}
                  className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
                  )}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print bin label
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Parts in this location</CardTitle>
            <CardDescription className="text-slate-400">
              These parts are assigned to the scanned bin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.parts.length > 0 ? (
              [...summary.parts]
                .sort((left, right) => left.partNumber.localeCompare(right.partNumber))
                .map((part) => (
                  <Link
                    key={part.id}
                    href={`/inventory/${part.id}`}
                    className="block rounded-3xl border border-white/10 bg-slate-950/50 p-4 transition-colors hover:bg-white/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-white">{part.partNumber}</p>
                        <p className="mt-1 text-sm text-slate-200">{part.partName}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="border-white/10 bg-white/5 text-slate-200">
                          Qty {part.quantityOnHand}
                        </Badge>
                        <Badge className="border-white/10 bg-white/5 text-slate-200">
                          {getPartStockStatus(part)}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">
                      {part.universal ? "Universal part" : "Model-specific part"}
                    </p>
                  </Link>
                ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                No parts are assigned to this location yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
