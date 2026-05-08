"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, PackageSearch, Printer, QrCode, Search, Tag } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { APP_NAME, COMPANY_NAME } from "@/lib/brand";
import { getBinSummary, getPartLocationLabel, getPartStockStatus } from "@/lib/inventory-utils";
import type { Bin, Part } from "@/lib/inventory-types";

type LabelMode = "part" | "bin";

function buildPrintHref(options: {
  mode: LabelMode;
  part?: Part | null;
  bin?: Bin | null;
  copies: number;
}) {
  const params = new URLSearchParams({ copies: String(options.copies) });

  if (options.mode === "part" && options.part) {
    params.set("partId", options.part.id);
  }

  if (options.mode === "bin" && options.bin) {
    params.set("binId", options.bin.id);
  }

  return `/print?${params.toString()}`;
}

function normalizeCopies(value: string, fallback: number) {
  return Math.max(1, Math.min(12, Number(value) || fallback));
}

export function TagsPage({
  searchParams,
}: Readonly<{
  searchParams: {
    partId?: string;
    binId?: string;
    mode?: string;
  };
}>) {
  const { permissions } = useAuth();
  const { bins, getPartById, parts, settings } = useInventory();
  const initialMode: LabelMode =
    searchParams.mode === "bin" || searchParams.binId ? "bin" : "part";
  const [mode, setMode] = useState<LabelMode>(initialMode);
  const [query, setQuery] = useState("");
  const [copies, setCopies] = useState(String(settings.defaultPrintCopies));
  const [selectedPartId, setSelectedPartId] = useState(searchParams.partId ?? "");
  const [selectedBinId, setSelectedBinId] = useState(searchParams.binId ?? "");

  useEffect(() => {
    setCopies(String(settings.defaultPrintCopies));
  }, [settings.defaultPrintCopies]);

  useEffect(() => {
    if (searchParams.mode === "bin" || searchParams.binId) {
      setMode("bin");
      if (searchParams.binId) {
        setSelectedBinId(searchParams.binId);
      }
      setSelectedPartId("");
      return;
    }

    if (searchParams.mode === "part" || searchParams.partId) {
      setMode("part");
      if (searchParams.partId) {
        setSelectedPartId(searchParams.partId);
      }
      setSelectedBinId("");
      return;
    }
  }, [searchParams.binId, searchParams.mode, searchParams.partId]);

  const normalizedQuery = query.trim().toLowerCase();

  const partMatches = useMemo(() => {
    return [...parts]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .filter((part) => {
        if (mode !== "part") return false;
        if (!normalizedQuery) return true;
        return `${part.partNumber} ${part.partName} ${part.manufacturer} ${part.notes}`
          .toLowerCase()
          .includes(normalizedQuery);
      });
  }, [mode, normalizedQuery, parts]);

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

  const selectedPart = selectedPartId ? getPartById(selectedPartId) ?? null : null;
  const selectedBin = selectedBinId ? bins.find((bin) => bin.id === selectedBinId) ?? null : null;
  const selectedPrintHref = buildPrintHref({
    mode,
    part: selectedPart,
    bin: selectedBin,
    copies: normalizeCopies(copies, settings.defaultPrintCopies),
  });
  const canPrint = permissions.canPrintLabels && Boolean(selectedPart || selectedBin);

  const summaryCards = [
    { label: "Parts ready", value: parts.length, hint: "Available for tags", icon: <PackageSearch className="h-5 w-5" /> },
    { label: "Bins ready", value: bins.length, hint: "Available for bin labels", icon: <MapPin className="h-5 w-5" /> },
    {
      label: "Low stock",
      value: parts.filter((part) => getPartStockStatus(part) !== "healthy").length,
      hint: "Needs attention",
      icon: <Tag className="h-5 w-5" />,
      tone: "amber" as const,
    },
    {
      label: "Copies",
      value: normalizeCopies(copies, settings.defaultPrintCopies),
      hint: "Per print run",
      icon: <Printer className="h-5 w-5" />,
      tone: "emerald" as const,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Labels"
        title="Prepare part and bin labels."
        description="Choose a part or bin, check the preview, and send only the labels to the dedicated print route. The workflow stays simple for desktop and Android browsers."
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            <CardTitle className="text-white">Label picker</CardTitle>
            <CardDescription className="text-slate-400">
              Search for a part or location, then choose the label you want to print.
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
                onClick={() => setMode("part")}
              >
                <PackageSearch className="mr-2 h-4 w-4" />
                Part tags
              </Button>
              <Button
                variant={mode === "bin" ? "default" : "outline"}
                className={cn(
                  "h-12 justify-start",
                  mode === "bin"
                    ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
                onClick={() => setMode("bin")}
              >
                <MapPin className="mr-2 h-4 w-4" />
                Bin labels
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_160px]">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search</p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={
                      mode === "part"
                        ? "Search part number, name, or notes"
                        : "Search location code, aisle, shelf, or bin"
                    }
                    className="h-12 border-white/10 bg-slate-950/70 pl-9 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Copies</p>
                <Input
                  value={copies}
                  onChange={(event) => setCopies(event.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-11 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setQuery("");
                  setSelectedPartId("");
                  setSelectedBinId("");
                }}
              >
                Clear selection
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
                ? partMatches.slice(0, 8).map((part) => (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => setSelectedPartId(part.id)}
                      className={cn(
                        "rounded-3xl border p-4 text-left transition-colors",
                        selectedPartId === part.id
                          ? "border-emerald-400/30 bg-emerald-400/10"
                          : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                      )}
                    >
                      <p className="font-mono text-sm font-semibold text-white">{part.partNumber}</p>
                      <p className="mt-1 text-sm text-slate-200">{part.partName}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {getPartLocationLabel(part, bins)}
                      </p>
                    </button>
                  ))
                : binMatches.slice(0, 8).map((bin) => (
                    <button
                      key={bin.id}
                      type="button"
                      onClick={() => setSelectedBinId(bin.id)}
                      className={cn(
                        "rounded-3xl border p-4 text-left transition-colors",
                        selectedBinId === bin.id
                          ? "border-emerald-400/30 bg-emerald-400/10"
                          : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                      )}
                    >
                      <p className="font-mono text-sm font-semibold text-white">{bin.code}</p>
                      <p className="mt-1 text-sm text-slate-200">{bin.name}</p>
                      <p className="mt-2 text-xs text-slate-400">{bin.description}</p>
                    </button>
                  ))}
            </div>

            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
              {mode === "part"
                ? `${partMatches.length} part tag${partMatches.length === 1 ? "" : "s"} found.`
                : `${binMatches.length} bin label${binMatches.length === 1 ? "" : "s"} found.`}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Selected preview</CardTitle>
            <CardDescription className="text-slate-400">
              This is the record that will open in the print layout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedPart ? (
              <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      Part tag
                    </Badge>
                    <p className="mt-3 font-mono text-lg font-semibold text-white">
                      {selectedPart.partNumber}
                    </p>
                    <p className="mt-1 text-sm text-slate-200">{selectedPart.partName}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <QrCode className="h-5 w-5 text-emerald-300" />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Location</p>
                    <p className="mt-2 text-sm text-white">{getPartLocationLabel(selectedPart, bins)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Stock</p>
                    <p className="mt-2 text-sm text-white">{getPartStockStatus(selectedPart)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                    {selectedPart.manufacturer}
                  </Badge>
                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                    {selectedPart.category}
                  </Badge>
                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                    Qty {selectedPart.quantityOnHand}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/inventory/${selectedPart.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Open part
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
            ) : selectedBin ? (
              <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      Bin tag
                    </Badge>
                    <p className="mt-3 font-mono text-lg font-semibold text-white">
                      {selectedBin.code}
                    </p>
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
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                    {selectedBin.manufacturer || "General"}
                  </Badge>
                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                    {getBinSummary(selectedBin, parts).parts.length} parts
                  </Badge>
                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                    {getBinSummary(selectedBin, parts).lowStockCount} low
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/locations"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Open locations
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
                  <h2 className="text-lg font-semibold text-white">Select a label to print</h2>
                  <p className="max-w-md text-sm leading-6 text-slate-400">
                    Pick a part or bin on the left, then send it to the print layout. The print page only shows labels.
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
              <p className="font-medium text-white">{APP_NAME}</p>
              <p className="mt-1 text-slate-400">
                {COMPANY_NAME} label workflow for parts room printers, bin tags, and Android mobile use.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
