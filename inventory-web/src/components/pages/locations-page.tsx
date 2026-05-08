"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Boxes, MapPin, PackageSearch, Tag } from "lucide-react";

import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getBinSummary, getPartStockStatus } from "@/lib/inventory-utils";

export function LocationsPage() {
  const { bins, parts } = useInventory();
  const [query, setQuery] = useState("");

  const filteredBins = useMemo(() => {
    const search = query.trim().toLowerCase();
    return bins.filter((bin) => {
      if (!search) return true;
      return `${bin.code} ${bin.name} ${bin.description} ${bin.aisle} ${bin.manufacturer ?? ""}`
        .toLowerCase()
        .includes(search);
    });
  }, [bins, query]);

  const sortedBins = [...filteredBins].sort((left, right) => left.code.localeCompare(right.code));
  const assignedParts = parts.filter((part) => part.binId !== null);
  const unassignedParts = parts.filter((part) => part.binId === null);
  const lowStockBins = bins.filter((bin) => getBinSummary(bin, parts).lowStockCount > 0);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Locations"
        title="Warehouse and shelf location dashboard."
        description="This screen helps the team inspect bins, count stock by zone, and move quickly between the physical shelf map and the digital record."
        actions={
          <>
            <Link
              href="/lookup"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <PackageSearch className="mr-2 h-4 w-4" />
              Lookup
            </Link>
            <Link
              href="/tags"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-amber-400 text-slate-950 hover:bg-amber-300",
              )}
            >
              <Tag className="mr-2 h-4 w-4" />
              Bin tags
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Bins"
          value={bins.length}
          hint="Tracked storage locations"
          icon={<MapPin className="h-5 w-5" />}
        />
        <StatCard
          label="Assigned parts"
          value={assignedParts.length}
          hint="Already placed in a bin"
          icon={<Boxes className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Unassigned parts"
          value={unassignedParts.length}
          hint="Need location review"
          icon={<PackageSearch className="h-5 w-5" />}
          tone="rose"
        />
        <StatCard
          label="Bins with low stock"
          value={lowStockBins.length}
          hint="Need a reorder pass"
          icon={<MapPin className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search bins</p>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search bin code, shelf name, aisle, or manufacturer"
              className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {sortedBins.length} matching bins
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {lowStockBins.length} low-stock zones
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {unassignedParts.length} parts still need a home
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {sortedBins.map((bin) => {
          const summary = getBinSummary(bin, parts);
          const previewParts = summary.parts.slice(0, 4);

          return (
            <Card key={bin.id} className="border-white/10 bg-white/5">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-white">
                    {bin.code} · {bin.name}
                  </CardTitle>
                  <CardDescription className="text-slate-400">{bin.description}</CardDescription>
                </div>
                <Badge className="border-white/10 bg-white/5 text-slate-200">
                  {bin.aisle}-{bin.row}-{bin.column}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Parts</p>
                    <p className="mt-2 text-xl font-semibold text-white">{summary.parts.length}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Units</p>
                    <p className="mt-2 text-xl font-semibold text-white">{summary.totalUnits}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Low stock</p>
                    <p className="mt-2 text-xl font-semibold text-white">{summary.lowStockCount}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                    {bin.manufacturer || "General"}
                  </Badge>
                  {bin.notes && <Badge className="border-white/10 bg-white/5 text-slate-200">{bin.notes}</Badge>}
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Stored parts</p>
                  <div className="space-y-2">
                    {previewParts.map((part) => (
                      <div
                        key={part.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{part.partNumber}</p>
                          <p className="truncate text-xs text-slate-400">{part.partName}</p>
                        </div>
                        <Badge
                          className={cn(
                            "border",
                            getPartStockStatus(part) === "critical"
                              ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                              : getPartStockStatus(part) === "low"
                                ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                                : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
                          )}
                        >
                          {part.quantityOnHand}
                        </Badge>
                      </div>
                    ))}

                    {previewParts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
                        No parts assigned yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/tags?binId=${bin.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    Print bin tag
                  </Link>
                  <Link
                    href="/lookup"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    View lookup
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {sortedBins.length === 0 && (
          <Card className="border-dashed border-white/10 bg-white/5">
            <CardContent className="flex min-h-[18rem] items-center justify-center p-8 text-sm text-slate-400">
              No bins match the current search.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
