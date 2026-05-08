"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Boxes,
  MapPin,
  PackageSearch,
  ScanSearch,
} from "lucide-react";

import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  countCompatiblePartsForModel,
  getPartLocationLabel,
  getPartLookupBlob,
  getPartStockStatus,
  requiresAttention,
} from "@/lib/inventory-utils";

type LookupMode = "all" | "parts" | "bins" | "models";

export function LookupPage() {
  const { bins, models, parts, summary, getCompatibleModels } = useInventory();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<LookupMode>("all");

  const normalizedQuery = query.trim().toLowerCase();

  const partMatches = useMemo(() => {
    return parts.filter((part) => {
      if (mode !== "all" && mode !== "parts") return false;
      if (!normalizedQuery) return true;
      return getPartLookupBlob(part, bins, models).includes(normalizedQuery);
    });
  }, [bins, models, mode, normalizedQuery, parts]);

  const binMatches = useMemo(() => {
    return bins.filter((bin) => {
      if (mode !== "all" && mode !== "bins") return false;
      if (!normalizedQuery) return true;
      return `${bin.code} ${bin.name} ${bin.description} ${bin.aisle}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [bins, mode, normalizedQuery]);

  const modelMatches = useMemo(() => {
    return models.filter((model) => {
      if (mode !== "all" && mode !== "models") return false;
      if (!normalizedQuery) return true;
      return `${model.manufacturer} ${model.name} ${model.series} ${model.status}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [models, mode, normalizedQuery]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Fast lookup"
        title="Find a part, bin, or model without leaving the floor."
        description="This mobile-first search screen is designed for quick checks on a desktop monitor or an Android phone. Type a part number, bin code, or model name to jump straight to the right record."
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
              Inventory
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Matches"
          value={partMatches.length + binMatches.length + modelMatches.length}
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
          value={modelMatches.length}
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

          <div className="flex flex-wrap gap-2">
            {(["all", "parts", "bins", "models"] as LookupMode[]).map((item) => (
              <Button
                key={item}
                variant={mode === item ? "default" : "outline"}
                className={cn(
                  "h-10 capitalize",
                  mode === item
                    ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
                onClick={() => setMode(item)}
              >
                {item}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Parts</CardTitle>
            <CardDescription className="text-slate-400">
              Search result cards with quantity, location, and compatibility at a glance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {partMatches.map((part) => {
              const stockStatus = getPartStockStatus(part);
              const compatibleModels = getCompatibleModels(part);

              return (
                <div
                  key={part.id}
                  className="rounded-3xl border border-white/10 bg-slate-950/50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                          Qty
                        </p>
                        <p className="mt-1 text-xl font-semibold text-white">
                          {part.quantityOnHand}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                          Models
                        </p>
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

            {partMatches.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                No parts matched the current search.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Bins</CardTitle>
              <CardDescription className="text-slate-400">
                Quick storage lookup for phone and desktop use.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {binMatches.map((bin) => (
                <div key={bin.id} className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {bin.code} · {bin.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{bin.description}</p>
                    </div>
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      {bin.aisle}-{bin.row}-{bin.column}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      {bin.manufacturer || "General"}
                    </Badge>
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      {parts.filter((part) => part.binId === bin.id).length} parts
                    </Badge>
                  </div>
                </div>
              ))}

              {binMatches.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                  No bins matched the current search.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Models</CardTitle>
              <CardDescription className="text-slate-400">
                Matching printer and copier models with compatibility counts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {modelMatches.map((model) => {
                const compatibleCount = countCompatiblePartsForModel(parts, model.id);
                return (
                  <div key={model.id} className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {model.manufacturer} {model.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {model.series} · {model.status}
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
                  </div>
                );
              })}

              {modelMatches.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                  No models matched the current search.
                </div>
              )}
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
      </div>
    </div>
  );
}
