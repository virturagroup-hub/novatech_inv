"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Boxes, MapPin, PackageSearch, Plus, Search, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Bin, BinDraft } from "@/lib/inventory-types";
import { getBinStatusLabel, getBinSummary } from "@/lib/inventory-utils";

function emptyBinDraft(): BinDraft {
  return {
    code: "",
    name: "",
    description: "",
    aisle: "",
    row: 1,
    column: 1,
    manufacturer: null,
    status: "active",
    notes: "",
  };
}

function binDraftFromBin(bin?: Bin | null): BinDraft {
  if (!bin) return emptyBinDraft();
  return {
    code: bin.code,
    name: bin.name,
    description: bin.description,
    aisle: bin.aisle,
    row: bin.row,
    column: bin.column,
    manufacturer: bin.manufacturer,
    status: bin.status,
    notes: bin.notes ?? "",
  };
}

export function LocationsPage() {
  const { permissions } = useAuth();
  const { bins, parts, saveBin, setBinStatus } = useInventory();
  const [query, setQuery] = useState("");
  const [selectedBinId, setSelectedBinId] = useState<string | "new">(bins[0]?.id ?? "new");
  const [binDraft, setBinDraft] = useState<BinDraft>(binDraftFromBin(bins[0] ?? null));

  useEffect(() => {
    if (selectedBinId === "new") {
      setBinDraft(emptyBinDraft());
      return;
    }

    const selectedBin = bins.find((bin) => bin.id === selectedBinId);
    if (selectedBin) {
      setBinDraft(binDraftFromBin(selectedBin));
      return;
    }

    const firstBin = bins[0] ?? null;
    setSelectedBinId(firstBin?.id ?? "new");
    setBinDraft(binDraftFromBin(firstBin));
  }, [bins, selectedBinId]);

  const filteredBins = useMemo(() => {
    const search = query.trim().toLowerCase();
    return bins.filter((bin) => {
      if (!search) return true;
      return `${bin.code} ${bin.name} ${bin.description} ${bin.aisle} ${bin.manufacturer ?? ""} ${bin.status}`
        .toLowerCase()
        .includes(search);
    });
  }, [bins, query]);

  const sortedBins = [...filteredBins].sort((left, right) => left.code.localeCompare(right.code));
  const lowStockBins = bins.filter((bin) => getBinSummary(bin, parts).lowStockCount > 0);
  const activeCount = bins.filter((bin) => bin.status === "active").length;
  const inactiveCount = bins.filter((bin) => bin.status === "inactive").length;

  const selectedBin = selectedBinId === "new" ? null : bins.find((bin) => bin.id === selectedBinId) ?? null;

  const handleSave = () => {
    if (!permissions.canManageLocations) {
      toast.error("Your role cannot edit locations.");
      return;
    }

    if (!binDraft.code.trim() || !binDraft.name.trim()) {
      toast.error("Location code and name are required.");
      return;
    }

    saveBin({
      ...binDraft,
      code: binDraft.code.trim(),
      name: binDraft.name.trim(),
      description: binDraft.description.trim(),
      aisle: binDraft.aisle.trim(),
      row: Number(binDraft.row) || 1,
      column: Number(binDraft.column) || 1,
      manufacturer: binDraft.manufacturer?.trim() || null,
      notes: binDraft.notes.trim(),
      id: selectedBin?.id,
    });

    toast.success(selectedBin ? "Location updated" : "Location added");
    setSelectedBinId(selectedBin?.id ?? "new");
  };

  const toggleStatus = () => {
    if (!selectedBin || !permissions.canManageLocations) return;

    const nextStatus = selectedBin.status === "active" ? "inactive" : "active";
    setBinStatus(selectedBin.id, nextStatus);
    setBinDraft((current) => ({ ...current, status: nextStatus }));
    toast.success(nextStatus === "active" ? "Location restored" : "Location archived");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Locations"
        title="Manage shelf locations and bin labels."
        description="Track location codes, shelf areas, and storage bins in a way the crew can understand at a glance. Archive old locations instead of deleting them."
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
                "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
              )}
            >
              <MapPin className="mr-2 h-4 w-4" />
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
          label="Low-stock bins"
          value={lowStockBins.length}
          hint="Need reorder attention"
          icon={<MapPin className="h-5 w-5" />}
          tone="rose"
        />
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search</p>
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
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Role access</p>
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
              {permissions.canManageLocations
                ? "You can add, edit, and archive locations."
                : "You can search and view locations. Elevated users can manage them."}
            </div>
          </div>
        </CardContent>
      </Card>

      {!permissions.canManageLocations && (
        <Card className="border-amber-400/20 bg-amber-400/10">
          <CardContent className="p-4 text-sm text-amber-100">
            Your current role can view locations, but only admins and managers can change them.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">
              {permissions.canManageLocations ? "Edit location" : "Location details"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Use simple field names so the shelf map stays easy to maintain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-200">Location code</Label>
                <Input
                  value={binDraft.code}
                  onChange={(event) => setBinDraft((current) => ({ ...current, code: event.target.value }))}
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                  disabled={!permissions.canManageLocations}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Name</Label>
                <Input
                  value={binDraft.name}
                  onChange={(event) => setBinDraft((current) => ({ ...current, name: event.target.value }))}
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                  disabled={!permissions.canManageLocations}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Description</Label>
              <Textarea
                value={binDraft.description}
                onChange={(event) =>
                  setBinDraft((current) => ({ ...current, description: event.target.value }))
                }
                className="min-h-24 border-white/10 bg-slate-950/70 text-white"
                disabled={!permissions.canManageLocations}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-slate-200">Area</Label>
                <Input
                  value={binDraft.aisle}
                  onChange={(event) =>
                    setBinDraft((current) => ({ ...current, aisle: event.target.value }))
                  }
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                  disabled={!permissions.canManageLocations}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Shelf</Label>
                <Input
                  type="number"
                  min={1}
                  value={binDraft.row}
                  onChange={(event) =>
                    setBinDraft((current) => ({
                      ...current,
                      row: Number(event.target.value) || 1,
                    }))
                  }
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                  disabled={!permissions.canManageLocations}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Bin</Label>
                <Input
                  type="number"
                  min={1}
                  value={binDraft.column}
                  onChange={(event) =>
                    setBinDraft((current) => ({
                      ...current,
                      column: Number(event.target.value) || 1,
                    }))
                  }
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                  disabled={!permissions.canManageLocations}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Manufacturer</Label>
              <Select
                value={binDraft.manufacturer ?? "all"}
                onValueChange={(value) =>
                  setBinDraft((current) => ({
                    ...current,
                    manufacturer: value && value !== "all" ? value : null,
                  }))
                }
                disabled={!permissions.canManageLocations}
              >
                <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                  <SelectValue placeholder="General" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">General</SelectItem>
                  {["Canon", "HP", "Konica Minolta", "Ricoh", "Sharp", "Xerox", "Riso", "Universal"].map(
                    (manufacturer) => (
                      <SelectItem key={manufacturer} value={manufacturer}>
                        {manufacturer}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-200">Status</Label>
                <Select
                  value={binDraft.status}
                  onValueChange={(value) =>
                    setBinDraft((current) => ({
                      ...current,
                      status: value as BinDraft["status"],
                    }))
                  }
                  disabled={!permissions.canManageLocations}
                >
                  <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Notes</Label>
                <Input
                  value={binDraft.notes}
                  onChange={(event) => setBinDraft((current) => ({ ...current, notes: event.target.value }))}
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                  disabled={!permissions.canManageLocations}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {permissions.canManageLocations && (
                <>
                  <Button className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={handleSave}>
                    <Plus className="mr-2 h-4 w-4" />
                    {selectedBin ? "Save location" : "Add location"}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setSelectedBinId("new");
                      setBinDraft(emptyBinDraft());
                    }}
                  >
                    New location
                  </Button>
                  {selectedBin && (
                    <Button
                      variant="outline"
                      className={cn(
                        "border-white/10 bg-white/5 hover:bg-white/10 hover:text-white",
                        selectedBin.status === "active"
                          ? "text-amber-100"
                          : "text-emerald-100",
                      )}
                      onClick={toggleStatus}
                    >
                      {selectedBin.status === "active" ? (
                        <>
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </>
                      ) : (
                        <>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Location catalog</CardTitle>
            <CardDescription className="text-slate-400">
              Choose a record to review the current shelf map and low-stock pressure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedBins.map((bin) => {
              const summary = getBinSummary(bin, parts);
              const active = selectedBinId === bin.id;

              return (
                <button
                  key={bin.id}
                  type="button"
                  onClick={() => {
                    setSelectedBinId(bin.id);
                    setBinDraft(binDraftFromBin(bin));
                  }}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-3xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-emerald-400/30 bg-emerald-400/10"
                      : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {bin.code} · {bin.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{bin.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge
                        className={cn(
                          "border",
                          bin.status === "inactive"
                            ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
                        )}
                      >
                        {getBinStatusLabel(bin)}
                      </Badge>
                      <Badge className="border-white/10 bg-white/5 text-slate-200">
                        {bin.aisle}-{bin.row}-{bin.column}
                      </Badge>
                      <Badge className="border-white/10 bg-white/5 text-slate-200">
                        {summary.parts.length} parts
                      </Badge>
                      <Badge className="border-white/10 bg-white/5 text-slate-200">
                        {summary.lowStockCount} low
                      </Badge>
                    </div>
                  </div>
                  {active && <Badge className="border-white/10 bg-white/5 text-slate-200">Selected</Badge>}
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
