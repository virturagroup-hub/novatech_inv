"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, Boxes, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getBinStatusLabel, getBinSummary } from "@/lib/inventory-utils";

function formatBinCode(aisle: string, row: number, column: number) {
  return `${aisle}-${row}-${column}`;
}

export function LocationsPage() {
  const { permissions } = useAuth();
  const { bins, parts, deleteBin, setBinStatus } = useInventory();
  const [query, setQuery] = useState("");

  const filteredBins = useMemo(() => {
    const search = query.trim().toLowerCase();

    return [...bins]
      .sort((left, right) => left.code.localeCompare(right.code))
      .filter((bin) => {
        if (!search) return true;
        return `${bin.code} ${bin.name} ${bin.description} ${bin.aisle} ${bin.row} ${bin.column} ${bin.manufacturer ?? ""} ${bin.status} ${bin.notes ?? ""}`
          .toLowerCase()
          .includes(search);
      });
  }, [bins, query]);

  const activeCount = bins.filter((bin) => bin.status === "active").length;
  const inactiveCount = bins.filter((bin) => bin.status === "inactive").length;
  const linkedBinCount = bins.filter((bin) => getBinSummary(bin, parts).parts.length > 0).length;

  const handleStatusToggle = (binId: string, nextStatus: "active" | "inactive", label: string) => {
    if (!window.confirm(`${nextStatus === "active" ? "Restore" : "Archive"} ${label}?`)) {
      return;
    }

    setBinStatus(binId, nextStatus);
    toast.success(nextStatus === "active" ? "Location restored" : "Location archived");
  };

  const handleDelete = (binId: string, label: string) => {
    if (!window.confirm(`Delete ${label}? Parts assigned to it will become unassigned.`)) {
      return;
    }

    deleteBin(binId);
    toast.success("Location deleted");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Locations"
        title="Manage shelf locations and bin labels."
        description="Keep location codes, areas, shelves, and bins simple for technicians. Archive old locations instead of deleting them when parts are still assigned."
        actions={
          permissions.canManageLocations ? (
            <Link
              href="/locations/new"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
              )}
            >
              <Plus className="mr-2 h-4 w-4" />
              New location
            </Link>
          ) : null
        }
      />

      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Bins"
          value={bins.length}
          hint="Tracked storage locations"
          icon={<MapPin className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={activeCount}
          hint="Open for use"
          icon={<Boxes className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Inactive"
          value={inactiveCount}
          hint="Archived locations"
          icon={<Archive className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Linked bins"
          value={linkedBinCount}
          hint="Have assigned parts"
          icon={<MapPin className="h-5 w-5" />}
          tone="sky"
        />
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search locations</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search code, area, shelf, bin, description, or notes"
                className="h-12 border-white/10 bg-slate-950/70 pl-9 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
            Open a location to review the assigned parts, or edit a record when you need to move shelves around.
          </div>
        </CardContent>
      </Card>

      {!permissions.canManageLocations && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4 text-sm text-slate-300">
            You can view locations and scan bin labels. Admins and managers can add or edit the shelf map.
          </CardContent>
        </Card>
      )}

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Location catalog</CardTitle>
          <CardDescription className="text-slate-400">
            Click a row to open the location detail page. Edit and archive controls appear for elevated users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredBins.length > 0 ? (
            <ScrollArea className="h-[clamp(24rem,60vh,42rem)] rounded-3xl border border-white/10 bg-slate-950/50">
              <div className="space-y-3 p-3 pr-4">
                {filteredBins.map((bin) => {
            const summary = getBinSummary(bin, parts);
            const partCount = summary.parts.length;
            const linked = partCount > 0;
            const safeToDelete = !linked;

            return (
              <div
                key={bin.id}
                className="rounded-[1.75rem] border border-white/10 bg-slate-950/50 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-white">
                        {bin.code} · {bin.name}
                      </p>
                      {linked && (
                        <Badge className="border-sky-400/20 bg-sky-400/10 text-sky-100">
                          {partCount} parts
                        </Badge>
                      )}
                      {!linked && (
                        <Badge className="border-white/10 bg-white/5 text-slate-200">
                          Empty
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{bin.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-white/10 bg-white/5 text-slate-200">
                        {formatBinCode(bin.aisle, bin.row, bin.column)}
                      </Badge>
                      <Badge
                        className={
                          bin.status === "inactive"
                            ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                        }
                      >
                        {getBinStatusLabel(bin)}
                      </Badge>
                      {bin.manufacturer && (
                        <Badge className="border-white/10 bg-white/5 text-slate-200">
                          {bin.manufacturer}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/locations/${bin.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "default" }),
                        "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      View
                    </Link>
                    {permissions.canManageLocations && (
                      <Link
                        href={`/locations/${bin.id}/edit`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "default" }),
                          "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        Edit
                      </Link>
                    )}
                    {permissions.canManageLocations && (
                      <Button
                        variant="outline"
                        className={cn(
                          "border-white/10 bg-white/5 hover:bg-white/10 hover:text-white",
                          bin.status === "active" ? "text-amber-100" : "text-emerald-100",
                        )}
                        onClick={() =>
                          handleStatusToggle(
                            bin.id,
                            bin.status === "active" ? "inactive" : "active",
                            `${bin.code} · ${bin.name}`,
                          )
                        }
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        {bin.status === "active" ? "Archive" : "Restore"}
                      </Button>
                    )}
                    {permissions.canManageLocations && safeToDelete && (
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(bin.id, `${bin.code} · ${bin.name}`)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
              </div>
            </ScrollArea>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
              No locations matched the current search.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
