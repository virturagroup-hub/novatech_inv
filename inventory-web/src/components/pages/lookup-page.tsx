"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Boxes, MapPin, PackageSearch, ScanSearch } from "lucide-react";

import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  countCompatiblePartsForModel,
  getPartLocationLabel,
  getPartLookupBlob,
  getPartStockStatus,
  requiresAttention,
} from "@/lib/inventory-utils";
import {
  getModelDisplayName,
  getModelSearchReason,
  groupModelsForSearch,
} from "@/lib/model-search";

type LookupMode = "parts" | "bins" | "models";

const lookupModes: Array<{ value: LookupMode; label: string }> = [
  { value: "parts", label: "Parts" },
  { value: "bins", label: "Bins" },
  { value: "models", label: "Models" },
];

function getBinSearchBlob(bin: { code: string; name: string; description: string; aisle: string; row: number; column: number; manufacturer: string | null; }) {
  return `${bin.code} ${bin.name} ${bin.description} ${bin.aisle} ${bin.row} ${bin.column} ${bin.manufacturer ?? ""}`
    .toLowerCase()
    .trim();
}

export function LookupPage() {
  const { bins, models, parts, summary, getCompatibleModels, getDisplayPartNumber } = useInventory();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<LookupMode>("parts");

  const normalizedQuery = query.trim().toLowerCase();

  const partMatches = useMemo(() => {
    return [...parts]
      .sort((left, right) => {
        const leftNumber = getDisplayPartNumber(left);
        const rightNumber = getDisplayPartNumber(right);
        return leftNumber.localeCompare(rightNumber) || left.partName.localeCompare(right.partName);
      })
      .filter((part) => {
        if (!normalizedQuery) return true;
        return getPartLookupBlob(part, bins, models).includes(normalizedQuery);
      });
  }, [bins, getDisplayPartNumber, models, normalizedQuery, parts]);

  const binMatches = useMemo(() => {
    return [...bins]
      .sort((left, right) => left.code.localeCompare(right.code) || left.name.localeCompare(right.name))
      .filter((bin) => {
        if (!normalizedQuery) return true;
        return getBinSearchBlob(bin).includes(normalizedQuery);
      });
  }, [bins, normalizedQuery]);

  const modelGroups = useMemo(() => groupModelsForSearch(models, query), [models, query]);
  const modelMatchCount = useMemo(
    () => modelGroups.reduce((sum, group) => sum + group.models.length, 0),
    [modelGroups],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Fast lookup"
        title="Find a part, bin, or model without leaving the floor."
        description="This mobile-first search screen is designed for quick checks on a desktop monitor or an Android phone. Type a part number, bin code, or model name to jump straight to the right record."
        actions={
          <Link
            href="/inventory"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
            )}
          >
            <PackageSearch className="mr-2 h-4 w-4" />
            Inventory
          </Link>
        }
      />

      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Matches"
          value={partMatches.length + binMatches.length + modelMatchCount}
          hint="Across all record types"
          icon={<ScanSearch className="h-5 w-5" />}
        />
        <StatCard
          label="Parts"
          value={partMatches.length}
          hint="Part numbers, names, or notes"
          icon={<PackageSearch className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="Bins"
          value={binMatches.length}
          hint="Location and bin code hits"
          icon={<MapPin className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Models"
          value={modelMatchCount}
          hint="Compatible device records"
          icon={<Boxes className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search</p>
            <div className="relative">
              <ScanSearch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Enter a part number, bin code, printer model, or keyword"
                className="h-14 border-white/10 bg-slate-950/80 pl-10 text-base text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <Tabs value={mode} onValueChange={(value) => setMode(value as LookupMode)} className="space-y-4">
            <TabsList className="grid h-auto grid-cols-3 bg-white/5 p-1">
              {lookupModes.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950"
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="parts" className="mt-0">
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white">Parts</CardTitle>
                  <CardDescription className="text-slate-400">
                    Search result cards with quantity, location, and compatibility at a glance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {partMatches.length > 0 ? (
                    <ScrollArea className="h-[clamp(18rem,60vh,32rem)] rounded-3xl border border-white/10 bg-slate-950/50">
                      <div className="space-y-3 p-3 pr-4">
                        {partMatches.map((part) => {
                          const stockStatus = getPartStockStatus(part);
                          const compatibleModels = getCompatibleModels(part);

                          return (
                            <div key={part.id} className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-mono text-sm font-semibold text-white">
                                      {getDisplayPartNumber(part)}
                                    </p>
                                    <Badge
                                      className={cn(
                                        "border",
                                        stockStatus === "critical"
                                          ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                                          : stockStatus === "low"
                                            ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                                            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
                                      )}
                                    >
                                      {stockStatus}
                                    </Badge>
                                    {requiresAttention(part) && (
                                      <Badge className="border-white/10 bg-white/5 text-slate-200">
                                        Attention
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-2 text-sm font-semibold text-white">{part.partName}</p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {getPartLocationLabel(part, bins)} · {part.category}
                                  </p>
                                </div>
                                <div className="grid min-w-[170px] grid-cols-2 gap-2 text-right">
                                  <div>
                                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Qty</p>
                                    <p className="mt-1 text-xl font-semibold text-white">{part.quantityOnHand}</p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Models</p>
                                    <p className="mt-1 text-xl font-semibold text-slate-200">
                                      {part.universal ? "All" : compatibleModels.length}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <Link
                                  href={`/inventory/${part.id}`}
                                  className={cn(
                                    buttonVariants({ variant: "outline", size: "sm" }),
                                    "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                                  )}
                                >
                                  Open detail
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                      No parts matched the current search.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bins" className="mt-0">
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white">Bins</CardTitle>
                  <CardDescription className="text-slate-400">
                    Open a bin to see the parts stored in that location.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {binMatches.length > 0 ? (
                    <ScrollArea className="h-[clamp(18rem,60vh,32rem)] rounded-3xl border border-white/10 bg-slate-950/50">
                      <div className="space-y-3 p-3 pr-4">
                        {binMatches.map((bin) => {
                          const partCount = parts.filter((part) => part.binId === bin.id).length;

                          return (
                            <Link
                              key={bin.id}
                              href={`/locations/${bin.id}`}
                              className="block rounded-3xl border border-white/10 bg-slate-950/50 p-4 transition-colors hover:bg-white/10"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-white">
                                    {bin.code} · {bin.name}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">{bin.description}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge className="border-white/10 bg-white/5 text-slate-200">
                                  Area {bin.aisle} · Shelf {bin.row} · Bin {bin.column}
                                </Badge>
                                <Badge className="border-white/10 bg-white/5 text-slate-200">
                                  {bin.manufacturer || "General"}
                                </Badge>
                                <Badge className="border-white/10 bg-white/5 text-slate-200">
                                  {partCount} parts
                                </Badge>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                      No bins matched the current search.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="models" className="mt-0">
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white">Models</CardTitle>
                  <CardDescription className="text-slate-400">
                    Matching printer and copier models with compatibility counts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {modelGroups.length > 0 ? (
                    <ScrollArea className="h-[clamp(18rem,60vh,32rem)] rounded-3xl border border-white/10 bg-slate-950/50">
                      <div className="space-y-4 p-3 pr-4">
                        {modelGroups.map((group) => (
                          <div
                            key={group.familyKey}
                            className="rounded-[1.75rem] border border-white/10 bg-slate-950/50 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                                    Series / family
                                  </Badge>
                                  <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-100">
                                    {group.label}
                                  </Badge>
                                </div>
                                <p className="mt-2 text-sm font-semibold text-white">
                                  {group.manufacturer} family
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {getModelSearchReason(group)}
                                </p>
                              </div>
                              <Badge className="border-white/10 bg-white/5 text-slate-200">
                                {group.models.length} model{group.models.length === 1 ? "" : "s"}
                              </Badge>
                            </div>

                            <div className="mt-4 space-y-3">
                              {group.models.map((model) => {
                                const compatibleCount = countCompatiblePartsForModel(parts, model.id);

                                return (
                                  <Link
                                    key={model.id}
                                    href={`/models/${model.id}`}
                                    className="block rounded-3xl border border-white/10 bg-slate-950/50 p-4 transition-colors hover:bg-white/10"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-white">
                                          {getModelDisplayName(model)}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                          {model.series || "No series listed"} · {model.status}
                                        </p>
                                      </div>
                                      <Badge
                                        className={cn(
                                          "border",
                                          model.status === "inactive"
                                            ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                                            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
                                        )}
                                      >
                                        {compatibleCount} parts
                                      </Badge>
                                    </div>
                                    {model.notes && <p className="mt-2 text-xs text-slate-400">{model.notes}</p>}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                      No models matched the current search.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Coverage snapshot</CardTitle>
          <CardDescription className="text-slate-400">
            This search is backed by the same typed mock store that drives the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
            {summary.lowStockCount} parts are currently low stock and ready for reorder review.
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
            {summary.attentionCount} parts still need location or compatibility attention.
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
            {summary.coverage}% of parts already have compatibility data or are marked universal.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
