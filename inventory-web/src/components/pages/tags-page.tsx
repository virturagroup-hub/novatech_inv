"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Filter,
  MapPin,
  PackageSearch,
  Printer,
  QrCode,
  Search,
  Tag,
} from "lucide-react";

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
import { cn } from "@/lib/utils";
import { categories, type Bin, type Part } from "@/lib/inventory-types";
import { buildBinPrintHref, buildPartPrintHref, normalizePrintCopies, parseIdList, type LabelLayout, type LabelMode } from "@/lib/labels";
import {
  filterParts,
  filterPartsByLabelRecency,
  getPartLocationLabel,
  type LabelRecencyFilter,
} from "@/lib/inventory-utils";

type BuilderMode = "part" | "bin";

const MAX_VISIBLE_PARTS = 12;

function formatPartLocation(part: Part, bins: Bin[]) {
  const location = getPartLocationLabel(part, bins);
  return location.replace(" (Inactive)", "");
}

export function TagsPage({
  searchParams,
}: Readonly<{
  searchParams: {
    partId?: string;
    partIds?: string;
    binId?: string;
    mode?: string;
    labelMode?: string;
    copies?: string;
    includeZero?: string;
    layout?: string;
  };
}>) {
  const { permissions } = useAuth();
  const { activity, bins, getPartById, getDisplayPartNumber, models, parts, settings } = useInventory();

  const initialPartIds = parseIdList(searchParams.partIds ?? searchParams.partId);
  const initialMode: BuilderMode =
    searchParams.mode === "bin" || searchParams.binId ? "bin" : "part";
  const initialLabelMode: LabelMode =
    searchParams.labelMode === "copies" || searchParams.labelMode === "quantity"
      ? searchParams.labelMode
      : "each";
  const initialLayout: LabelLayout = searchParams.layout === "thermal" ? "thermal" : "sheet";

  const [mode, setMode] = useState<BuilderMode>(initialMode);
  const [query, setQuery] = useState("");
  const [labelMode, setLabelMode] = useState<LabelMode>(initialLabelMode);
  const [labelLayout, setLabelLayout] = useState<LabelLayout>(initialLayout);
  const [copies, setCopies] = useState(() =>
    String(normalizePrintCopies(searchParams.copies ?? settings.defaultPrintCopies, settings.defaultPrintCopies)),
  );
  const [includeZero, setIncludeZero] = useState(searchParams.includeZero === "1");
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>(initialPartIds);
  const [partCopyCounts, setPartCopyCounts] = useState<Record<string, number>>({});
  const [selectedBinId, setSelectedBinId] = useState(searchParams.binId ?? "");
  const [manufacturerFilter, setManufacturerFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [labelRecencyFilter, setLabelRecencyFilter] = useState<LabelRecencyFilter>("all");

  useEffect(() => {
    if (searchParams.binId || searchParams.mode === "bin") {
      setMode("bin");
      setSelectedBinId(searchParams.binId ?? selectedBinId);
      setSelectedPartIds([]);
      return;
    }

    if (searchParams.partId || searchParams.partIds || searchParams.mode === "part") {
      setMode("part");
      setSelectedPartIds(initialPartIds);
      setSelectedBinId("");
    }
  }, [initialPartIds, searchParams.binId, searchParams.mode, searchParams.partId, searchParams.partIds, selectedBinId]);

  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCopies = normalizePrintCopies(copies, settings.defaultPrintCopies);

  const manufacturerOptions = useMemo(
    () =>
      Array.from(new Set(parts.map((part) => part.manufacturer)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [parts],
  );

  const modelOptions = useMemo(
    () =>
      [...models].sort((left, right) =>
        `${left.manufacturer} ${left.name}`.localeCompare(`${right.manufacturer} ${right.name}`),
      ),
    [models],
  );

  const locationOptions = useMemo(
    () => [...bins].sort((left, right) => left.code.localeCompare(right.code)),
    [bins],
  );

  const partMatches = useMemo(() => {
    if (mode !== "part") return [];

    const filteredParts = filterParts(parts, bins, models, {
      query: query.trim(),
      manufacturer: manufacturerFilter === "all" ? "" : manufacturerFilter,
      category: categoryFilter === "all" ? "" : categoryFilter,
      binId:
        locationFilter === "all" || locationFilter === "unassigned" ? "" : locationFilter,
      modelId: modelFilter === "all" ? "" : modelFilter,
      status: "all",
    });

    const locationScopedParts =
      locationFilter === "unassigned"
        ? filteredParts.filter((part) => part.binId === null)
        : filteredParts;

    return filterPartsByLabelRecency(locationScopedParts, activity, labelRecencyFilter);
  }, [activity, bins, categoryFilter, labelRecencyFilter, locationFilter, manufacturerFilter, modelFilter, models, mode, parts, query]);

  const visiblePartMatches = partMatches.slice(0, MAX_VISIBLE_PARTS);
  const hasActiveFilters =
    Boolean(query.trim()) ||
    manufacturerFilter !== "all" ||
    modelFilter !== "all" ||
    categoryFilter !== "all" ||
    locationFilter !== "all" ||
    labelRecencyFilter !== "all";

  const binMatches = useMemo(() => {
    return [...bins]
      .sort((left, right) => left.code.localeCompare(right.code))
      .filter((bin) => {
        if (mode !== "bin") return false;
        if (!normalizedQuery) return true;

        return `${bin.code} ${bin.name} ${bin.description} ${bin.aisle} ${bin.row} ${bin.column} ${
          bin.manufacturer ?? ""
        }`
          .toLowerCase()
          .includes(normalizedQuery);
      });
  }, [bins, mode, normalizedQuery]);

  const selectedParts = useMemo(
    () =>
      selectedPartIds
        .map((partId) => getPartById(partId))
        .filter((part): part is Part => Boolean(part)),
    [getPartById, selectedPartIds],
  );

  const selectedBin = selectedBinId ? bins.find((bin) => bin.id === selectedBinId) ?? null : null;

  const getPartCopyCount = useCallback(
    (partId: string) => partCopyCounts[partId] ?? (labelMode === "copies" ? normalizedCopies : 1),
    [labelMode, normalizedCopies, partCopyCounts],
  );

  const clearFilters = () => {
    setQuery("");
    setManufacturerFilter("all");
    setModelFilter("all");
    setCategoryFilter("all");
    setLocationFilter("all");
    setLabelRecencyFilter("all");
  };

  const selectAllFilteredParts = () => {
    if (partMatches.length === 0) return;

    setMode("part");
    setSelectedBinId("");
    setSelectedPartIds((current) =>
      Array.from(new Set([...current, ...partMatches.map((part) => part.id)])),
    );
    setPartCopyCounts((current) => {
      const next = { ...current };

      partMatches.forEach((part) => {
        if (!next[part.id]) {
          next[part.id] = labelMode === "copies" ? normalizedCopies : 1;
        }
      });

      return next;
    });
  };

  const deselectAll = () => {
    setSelectedPartIds([]);
    setSelectedBinId("");
    setPartCopyCounts({});
  };

  const togglePartSelection = (partId: string) => {
    setMode("part");
    setSelectedBinId("");

    const isSelected = selectedPartIds.includes(partId);

    if (isSelected) {
      setSelectedPartIds((current) => current.filter((item) => item !== partId));
      setPartCopyCounts((current) => {
        if (!(partId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[partId];
        return next;
      });
      return;
    }

    setSelectedPartIds((current) => [...current, partId]);
    setPartCopyCounts((current) => ({
      ...current,
      [partId]: current[partId] ?? (labelMode === "copies" ? normalizedCopies : 1),
    }));
  };

  const estimatedLabelCount = useMemo(() => {
    if (mode === "bin") {
      return selectedBin ? normalizedCopies : 0;
    }

    if (labelMode === "quantity") {
      return selectedParts.reduce((total, part) => {
        const repeatCount = part.quantityOnHand > 0 ? part.quantityOnHand : includeZero ? 1 : 0;
        return total + repeatCount;
      }, 0);
    }

    return selectedParts.reduce((total, part) => total + getPartCopyCount(part.id), 0);
  }, [getPartCopyCount, includeZero, labelMode, mode, normalizedCopies, selectedBin, selectedParts]);

  const copiesByPart = useMemo(
    () =>
      selectedParts.reduce<Record<string, number>>((accumulator, part) => {
        accumulator[part.id] =
          labelMode === "quantity"
            ? part.quantityOnHand > 0
              ? part.quantityOnHand
              : includeZero
                ? 1
                : 0
            : getPartCopyCount(part.id);
        return accumulator;
      }, {}),
    [getPartCopyCount, includeZero, labelMode, selectedParts],
  );

  const selectedPrintHref =
    mode === "part" && selectedParts.length > 0
      ? buildPartPrintHref({
          partIds: selectedPartIds,
          labelMode,
          copies: normalizedCopies,
          includeZero,
          copiesByPart,
          layout: labelLayout,
        })
      : selectedBin
        ? buildBinPrintHref({
            binId: selectedBin.id,
            copies: normalizedCopies,
            layout: labelLayout,
          })
        : "/print";

  const canPrint = permissions.canPrintLabels && Boolean(selectedParts.length > 0 || selectedBin);

  const summaryCards = [
    {
      label: "Parts ready",
      value: parts.length,
      hint: "Available for scan labels",
      icon: <PackageSearch className="h-5 w-5" />,
    },
    {
      label: "Bins ready",
      value: bins.length,
      hint: "Available for location labels",
      icon: <MapPin className="h-5 w-5" />,
    },
    {
      label: "Selected",
      value: mode === "part" ? selectedParts.length : selectedBin ? 1 : 0,
      hint: mode === "part" ? "Part labels picked" : "Bin label picked",
      icon: <Tag className="h-5 w-5" />,
      tone: "emerald" as const,
    },
    {
      label: "Queued",
      value: estimatedLabelCount,
      hint: "Labels that will print",
      icon: <Printer className="h-5 w-5" />,
      tone: "sky" as const,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Labels"
        title="Prepare scan labels."
        description="Choose part labels or bin labels, preview the selection, and send only the clean scan labels to the print route."
        actions={
          <>
            <Link
              href="/inventory"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <PackageSearch className="mr-2 h-4 w-4" />
              Parts
            </Link>
            <Link
              href="/locations"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <MapPin className="mr-2 h-4 w-4" />
              Locations
            </Link>
          </>
        }
      />

      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            hint={card.hint}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </div>

      {!permissions.canPrintLabels && (
        <Card className="border-amber-400/20 bg-amber-400/10">
          <CardContent className="p-4 text-sm text-amber-100">
            Your current role can preview labels, but printing is restricted.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Label builder</CardTitle>
            <CardDescription className="text-slate-400">
              Search, filter, select, and choose how the labels should repeat on the page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant={mode === "part" ? "default" : "outline"}
                className={cn(
                  "h-12 justify-start",
                  mode === "part"
                    ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
                onClick={() => {
                  setMode("part");
                  setSelectedBinId("");
                }}
              >
                <PackageSearch className="mr-2 h-4 w-4" />
                Part labels
              </Button>
              <Button
                variant={mode === "bin" ? "default" : "outline"}
                className={cn(
                  "h-12 justify-start",
                  mode === "bin"
                    ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
                onClick={() => {
                  setMode("bin");
                  setSelectedPartIds([]);
                }}
              >
                <MapPin className="mr-2 h-4 w-4" />
                Bin labels
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search</p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={
                      mode === "part"
                        ? "Search part number, NPN, name, notes, or location"
                        : "Search location code, aisle, shelf, or description"
                    }
                    className="h-12 border-white/10 bg-slate-950/70 pl-9 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  {mode === "part" ? "Default copies" : "Sheets"}
                </p>
                <Input
                  value={copies}
                  onChange={(event) => setCopies(event.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                />
              </div>
            </div>

            {mode === "part" && (
              <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={labelMode === "each" ? "default" : "outline"}
                    className={cn(
                      "h-10",
                      labelMode === "each"
                        ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                    )}
                    onClick={() => setLabelMode("each")}
                  >
                    One each
                  </Button>
                  <Button
                    variant={labelMode === "copies" ? "default" : "outline"}
                    className={cn(
                      "h-10",
                      labelMode === "copies"
                        ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                    )}
                    onClick={() => setLabelMode("copies")}
                  >
                    Custom copies
                  </Button>
                  <Button
                    variant={labelMode === "quantity" ? "default" : "outline"}
                    className={cn(
                      "h-10",
                      labelMode === "quantity"
                        ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                    )}
                    onClick={() => setLabelMode("quantity")}
                  >
                    Quantity on hand
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Layout</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={labelLayout === "sheet" ? "default" : "outline"}
                        className={cn(
                          "h-10",
                          labelLayout === "sheet"
                            ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                            : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                        )}
                        onClick={() => setLabelLayout("sheet")}
                      >
                        Sheet
                      </Button>
                      <Button
                        variant={labelLayout === "thermal" ? "default" : "outline"}
                        className={cn(
                          "h-10",
                          labelLayout === "thermal"
                            ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                            : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                        )}
                        onClick={() => setLabelLayout("thermal")}
                      >
                        Thermal
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                    Thermal mode prints one label per page. Sheet mode keeps the full label grid.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeZero}
                      onChange={(event) => setIncludeZero(event.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-400"
                    />
                    Include zero-stock parts
                  </label>
                  <span className="text-xs text-slate-500">
                    Quantity mode prints one label per unit on hand.
                  </span>
                </div>
              </div>
            )}

            {mode === "part" && (
              <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Filters</p>
                    <p className="text-sm text-slate-300">
                      Narrow the part list by manufacturer, compatible model, category, or location.
                    </p>
                  </div>
                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                    {partMatches.length} match{partMatches.length === 1 ? "" : "es"}
                  </Badge>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-slate-200">Manufacturer</Label>
                    <Select
                      value={manufacturerFilter}
                      onValueChange={(value) => setManufacturerFilter(value ?? "all")}
                    >
                      <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
                        <SelectValue placeholder="All manufacturers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All manufacturers</SelectItem>
                        {manufacturerOptions.map((manufacturer) => (
                          <SelectItem key={manufacturer} value={manufacturer}>
                            {manufacturer}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200">Compatible model</Label>
                    <Select
                      value={modelFilter}
                      onValueChange={(value) => setModelFilter(value ?? "all")}
                    >
                      <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
                        <SelectValue placeholder="All models" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All models</SelectItem>
                        {modelOptions.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.manufacturer} {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200">Category</Label>
                    <Select
                      value={categoryFilter}
                      onValueChange={(value) => setCategoryFilter(value ?? "all")}
                    >
                      <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200">Location</Label>
                    <Select
                      value={locationFilter}
                      onValueChange={(value) => setLocationFilter(value ?? "all")}
                    >
                      <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
                        <SelectValue placeholder="Any location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any location</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {locationOptions.map((bin) => (
                          <SelectItem key={bin.id} value={bin.id}>
                            {bin.code} · {bin.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200">Label recency</Label>
                    <Select
                      value={labelRecencyFilter}
                      onValueChange={(value) => setLabelRecencyFilter(value as LabelRecencyFilter)}
                    >
                      <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
                        <SelectValue placeholder="All labels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All labels</SelectItem>
                        <SelectItem value="added-today">Added today</SelectItem>
                        <SelectItem value="added-last-3-days">Added last 3 days</SelectItem>
                        <SelectItem value="added-last-7-days">Added last 7 days</SelectItem>
                        <SelectItem value="quantity-increased-today">Quantity increased today</SelectItem>
                        <SelectItem value="quantity-increased-last-3-days">Quantity increased last 3 days</SelectItem>
                        <SelectItem value="quantity-increased-last-7-days">Quantity increased last 7 days</SelectItem>
                        <SelectItem value="added-or-quantity-increased-today">
                          Added or increased today
                        </SelectItem>
                        <SelectItem value="added-or-quantity-increased-last-3-days">
                          Added or increased last 3 days
                        </SelectItem>
                        <SelectItem value="added-or-quantity-increased-last-7-days">
                          Added or increased last 7 days
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {mode === "part" && (
                <Button
                  variant="outline"
                  className="h-11 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                  onClick={selectAllFilteredParts}
                  disabled={partMatches.length === 0}
                >
                  Select all filtered
                </Button>
              )}
              <Button
                variant="outline"
                className="h-11 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={deselectAll}
                disabled={mode === "part" ? selectedPartIds.length === 0 : !selectedBin}
              >
                Deselect all
              </Button>
              <Button
                variant="outline"
                className="h-11 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                <Filter className="mr-2 h-4 w-4" />
                Clear filters
              </Button>
              <Link
                href={selectedPrintHref}
                aria-disabled={!canPrint}
                tabIndex={canPrint ? 0 : -1}
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "h-11",
                  canPrint
                    ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                    : "pointer-events-none bg-slate-700 text-slate-300 opacity-60",
                )}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print labels
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {mode === "part"
                ? visiblePartMatches.map((part) => {
                    const selected = selectedPartIds.includes(part.id);

                    return (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => togglePartSelection(part.id)}
                        className={cn(
                          "rounded-3xl border p-4 text-left transition-colors",
                          selected
                            ? "border-emerald-400/30 bg-emerald-400/10"
                            : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-white">
                              {getDisplayPartNumber(part)}
                            </p>
                            <p className="mt-1 text-sm text-slate-200">{part.partName}</p>
                            <p className="mt-2 text-xs text-slate-400">
                              {formatPartLocation(part, bins)}
                            </p>
                          </div>
                          {selected && <Badge className="border-white/10 bg-white/5 text-slate-200">Selected</Badge>}
                        </div>
                      </button>
                    );
                  })
                : binMatches.slice(0, 12).map((bin) => {
                    const selected = selectedBinId === bin.id;

                    return (
                      <button
                        key={bin.id}
                        type="button"
                        onClick={() => {
                          setSelectedPartIds([]);
                          setSelectedBinId(bin.id);
                        }}
                        className={cn(
                          "rounded-3xl border p-4 text-left transition-colors",
                          selected
                            ? "border-emerald-400/30 bg-emerald-400/10"
                            : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-white">{bin.code}</p>
                            <p className="mt-1 text-sm text-slate-200">{bin.name}</p>
                            <p className="mt-2 text-xs text-slate-400">
                              {bin.aisle}-{bin.row}-{bin.column}
                            </p>
                          </div>
                          {selected && <Badge className="border-white/10 bg-white/5 text-slate-200">Selected</Badge>}
                        </div>
                      </button>
                    );
                  })}
            </div>

            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
              {mode === "part"
                ? `${partMatches.length} part tag${partMatches.length === 1 ? "" : "s"} found.`
                : `${binMatches.length} bin label${binMatches.length === 1 ? "" : "s"} found.`}
              {mode === "part" && partMatches.length > MAX_VISIBLE_PARTS ? (
                <p className="mt-2 text-xs text-slate-500">
                  Showing first {MAX_VISIBLE_PARTS} of {partMatches.length} matching parts.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Selected preview</CardTitle>
            <CardDescription className="text-slate-400">
              The right panel shows what will go to the print layout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "part" && selectedParts.length > 0 ? (
              <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge className="border-white/10 bg-white/5 text-slate-200">Part labels</Badge>
                    <p className="mt-3 text-sm text-slate-400">
                      {selectedParts.length} part{selectedParts.length === 1 ? "" : "s"} selected.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <QrCode className="h-5 w-5 text-emerald-300" />
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedParts.map((part) => (
                    <div
                      key={part.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-semibold text-white">
                          {getDisplayPartNumber(part)}
                        </p>
                        <p className="mt-1 text-sm text-slate-200">{part.partName}</p>
                        <p className="mt-2 text-xs text-slate-400">{formatPartLocation(part, bins)}</p>
                      </div>
                      <div className="w-full sm:w-32">
                        <Label className="text-xs uppercase tracking-[0.22em] text-slate-500">
                          Copies
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          value={getPartCopyCount(part.id)}
                          onChange={(event) =>
                            setPartCopyCounts((current) => ({
                              ...current,
                              [part.id]: normalizePrintCopies(event.target.value, 1),
                            }))
                          }
                          className="mt-2 h-11 border-white/10 bg-slate-900/80 text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Mode</p>
                    <p className="mt-2 text-sm text-white">
                      {labelMode === "each"
                        ? "One label each"
                        : labelMode === "copies"
                          ? `Custom copies x ${normalizedCopies}`
                          : includeZero
                            ? "Quantity on hand, including zero-stock parts"
                            : "Quantity on hand"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Queued</p>
                    <p className="mt-2 text-sm text-white">{estimatedLabelCount} labels</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                    Layout: {labelLayout === "thermal" ? "Thermal" : "Sheet"}
                  </Badge>
                  {labelMode === "quantity" && (
                    <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-200">
                      Quantity mode ignores copies
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/inventory/${selectedParts[0]?.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Open first part
                  </Link>
                  <Link
                    href={selectedPrintHref}
                    className={cn(
                      buttonVariants({ variant: "default", size: "default" }),
                      "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
                    )}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print labels
                  </Link>
                </div>
              </div>
            ) : mode === "bin" && selectedBin ? (
              <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge className="border-white/10 bg-white/5 text-slate-200">Bin labels</Badge>
                    <p className="mt-3 font-mono text-lg font-semibold text-white">{selectedBin.code}</p>
                    <p className="mt-1 text-sm text-slate-200">{selectedBin.name}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <QrCode className="h-5 w-5 text-emerald-300" />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Area</p>
                    <p className="mt-2 text-sm text-white">{selectedBin.aisle}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Shelf / Bin</p>
                    <p className="mt-2 text-sm text-white">
                      {selectedBin.row} / {selectedBin.column}
                    </p>
                  </div>
                </div>

                {selectedBin.description && (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Description</p>
                    <p className="mt-2 text-sm leading-6 text-white">{selectedBin.description}</p>
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Queued</p>
                    <p className="mt-2 text-sm text-white">
                      {estimatedLabelCount} label{estimatedLabelCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Scan target</p>
                    <p className="mt-2 text-sm text-white">Location detail page</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/locations/${selectedBin.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Open location
                  </Link>
                  <Link
                    href={selectedPrintHref}
                    className={cn(
                      buttonVariants({ variant: "default", size: "default" }),
                      "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
                    )}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print labels
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[26rem] flex-col items-center justify-center gap-4 rounded-[1.5rem] border border-dashed border-white/10 bg-slate-950/30 p-6 text-center">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <Tag className="h-8 w-8 text-emerald-300" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-white">Select labels to preview</h2>
                  <p className="max-w-md text-sm leading-6 text-slate-400">
                    Pick one or more parts on the left for part labels, or choose a bin for location labels.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Link
                    href="/inventory"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    Parts
                  </Link>
                  <Link
                    href="/locations"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    Locations
                  </Link>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
              <p className="font-medium text-white">Green NVentory</p>
              <p className="mt-1 text-slate-400">
                QR labels open the inventory or location record directly on desktop or Android mobile.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
