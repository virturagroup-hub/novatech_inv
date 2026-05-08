"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  MapPin,
  PackageSearch,
  Printer,
  Tag,
} from "lucide-react";

import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  getBinSummary,
  getPartLocationLabel,
  getPartStockStatus,
  requiresAttention,
} from "@/lib/inventory-utils";

export function TagsPage({ searchParams }: Readonly<{ searchParams?: { partId?: string; binId?: string } }>) {
  const { bins, parts, settings, getCompatibleModels } = useInventory();
  const [selectedPartId, setSelectedPartId] = useState(searchParams?.partId ?? parts[0]?.id ?? "");
  const [selectedBinId, setSelectedBinId] = useState(searchParams?.binId ?? bins[0]?.id ?? "");
  const [copies, setCopies] = useState(String(settings.defaultPrintCopies));
  const [partQuery, setPartQuery] = useState("");
  const [binQuery, setBinQuery] = useState("");

  const selectedPart = useMemo(
    () => parts.find((part) => part.id === selectedPartId) ?? null,
    [parts, selectedPartId],
  );
  const selectedBin = useMemo(
    () => bins.find((bin) => bin.id === selectedBinId) ?? null,
    [bins, selectedBinId],
  );
  const compatibleModels = selectedPart ? getCompatibleModels(selectedPart) : [];
  const binSummary = selectedBin ? getBinSummary(selectedBin, parts) : null;
  const filteredParts = useMemo(() => {
    const search = partQuery.trim().toLowerCase();
    if (!search) return parts;
    return parts.filter((part) =>
      `${part.partNumber} ${part.partName} ${part.manufacturer} ${part.notes}`.toLowerCase().includes(search),
    );
  }, [partQuery, parts]);
  const filteredBins = useMemo(() => {
    const search = binQuery.trim().toLowerCase();
    if (!search) return bins;
    return bins.filter((bin) =>
      `${bin.code} ${bin.name} ${bin.description} ${bin.manufacturer ?? ""}`.toLowerCase().includes(search),
    );
  }, [binQuery, bins]);

  const printTag = () => {
    window.print();
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Printable tags"
        title="Generate inventory and bin labels for the floor."
        description="Use these preview cards for quick printouts, bin tags, and barcode-style lookup sheets. The controls stay out of the print layout so the output is clean."
        actions={
          <>
            <Link
              href="/inventory"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Inventory
            </Link>
            <Button className="bg-amber-400 text-slate-950 hover:bg-amber-300" onClick={printTag}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Parts ready</p>
            <p className="mt-2 text-2xl font-semibold text-white">{parts.length}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Bins ready</p>
            <p className="mt-2 text-2xl font-semibold text-white">{bins.length}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Label copies</p>
            <p className="mt-2 text-2xl font-semibold text-white">{copies}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-white/5 print:hidden">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Selected copies</p>
              <div className="flex gap-2">
                <Input
                  value={copies}
                  onChange={(event) => setCopies(event.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className="border-white/10 bg-slate-950/70 text-white"
                />
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                  onClick={() => setCopies((current) => String(Math.max(1, Number(current) || 1)))}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Normalize
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Jump to</p>
              <div className="flex gap-2">
                <Link
                  href="/lookup"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "h-11 flex-1 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <PackageSearch className="mr-2 h-4 w-4" />
                  Lookup
                </Link>
                <Link
                  href="/locations"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "h-11 flex-1 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Locations
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="parts" className="space-y-4">
        <TabsList className="grid h-auto grid-cols-2 bg-white/5 p-1">
          <TabsTrigger value="parts" className="data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950">
            Part tags
          </TabsTrigger>
          <TabsTrigger value="bins" className="data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950">
            Bin tags
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parts" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="border-white/10 bg-white/5 print:hidden">
              <CardHeader>
                <CardTitle className="text-white">Pick a part</CardTitle>
                <CardDescription className="text-slate-400">
                  The preview updates as soon as you change the selection.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder="Filter part number or name"
                  value={partQuery}
                  onChange={(event) => setPartQuery(event.target.value)}
                  className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
                <div className="max-h-[30rem] space-y-2 overflow-auto pr-1">
                  {filteredParts.map((part) => {
                    const active = selectedPartId === part.id;
                    return (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => setSelectedPartId(part.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                          active
                            ? "border-amber-400/30 bg-amber-400/10"
                            : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                        )}
                      >
                        <Tag className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{part.partNumber}</p>
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
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {selectedPart ? (
              <Card className="border-white/10 bg-white/5">
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-white">Part tag preview</CardTitle>
                    <CardDescription className="text-slate-400">
                      Print this for shelf labels or service tickets.
                    </CardDescription>
                  </div>
                  <Badge
                    className={cn(
                      "border",
                      requiresAttention(selectedPart)
                        ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                        : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
                    )}
                  >
                    {requiresAttention(selectedPart) ? "Attention" : "Ready"}
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="rounded-[2rem] border border-dashed border-white/10 bg-slate-950/70 p-5 text-center">
                    <QRCodeSVG
                      value={`part:${selectedPart.partNumber}`}
                      includeMargin
                      size={176}
                      className="mx-auto rounded-2xl bg-white p-2"
                    />
                    <p className="mt-4 font-mono text-xs uppercase tracking-[0.24em] text-slate-500">
                      {selectedPart.partNumber}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Part</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{selectedPart.partName}</p>
                      <p className="mt-2 text-sm text-slate-400">
                        {selectedPart.manufacturer} · {selectedPart.category}
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Location</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {getPartLocationLabel(selectedPart, bins)}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Quantity</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {selectedPart.quantityOnHand} on hand
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Compatibility</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {selectedPart.universal ? "Universal" : compatibleModels.length + " models"}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Need by</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          Reorder point {selectedPart.reorderPoint}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">
                      Copies selected: {copies}. The print dialog will use your browser settings.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-white/10 bg-white/5">
                <CardContent className="flex min-h-[22rem] flex-col items-center justify-center gap-3 p-8 text-center">
                  <ClipboardList className="h-12 w-12 text-slate-500" />
                  <p className="text-sm text-slate-400">No part selected for tag preview.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bins" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="border-white/10 bg-white/5 print:hidden">
              <CardHeader>
                <CardTitle className="text-white">Pick a bin</CardTitle>
                <CardDescription className="text-slate-400">
                  Print a shelf tag or bin reference card.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder="Filter by bin code or name"
                  value={binQuery}
                  onChange={(event) => setBinQuery(event.target.value)}
                  className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
                <div className="max-h-[30rem] space-y-2 overflow-auto pr-1">
                  {filteredBins.map((bin) => {
                    const active = selectedBinId === bin.id;
                    return (
                      <button
                        key={bin.id}
                        type="button"
                        onClick={() => setSelectedBinId(bin.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                          active
                            ? "border-amber-400/30 bg-amber-400/10"
                            : "border-white/10 bg-slate-950/50 hover:bg-white/10",
                        )}
                      >
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{bin.code}</p>
                          <p className="truncate text-xs text-slate-400">{bin.name}</p>
                        </div>
                        <Badge className="border-white/10 bg-white/5 text-slate-200">
                          {parts.filter((part) => part.binId === bin.id).length}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {selectedBin ? (
              <Card className="border-white/10 bg-white/5">
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-white">Bin tag preview</CardTitle>
                    <CardDescription className="text-slate-400">
                      Shelf reference and location barcode for the aisle.
                    </CardDescription>
                  </div>
                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                    {binSummary?.parts.length ?? 0} parts
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="rounded-[2rem] border border-dashed border-white/10 bg-slate-950/70 p-5 text-center">
                    <QRCodeSVG
                      value={`bin:${selectedBin.code}`}
                      includeMargin
                      size={176}
                      className="mx-auto rounded-2xl bg-white p-2"
                    />
                    <p className="mt-4 font-mono text-xs uppercase tracking-[0.24em] text-slate-500">
                      {selectedBin.code}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Bin</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{selectedBin.name}</p>
                      <p className="mt-2 text-sm text-slate-400">{selectedBin.description}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Aisle</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {selectedBin.aisle}-{selectedBin.row}-{selectedBin.column}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Category</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {selectedBin.manufacturer || "General"}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Parts stored</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {binSummary?.parts.length ?? 0}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Low stock</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {binSummary?.lowStockCount ?? 0}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">
                      Suggested usage: print one bin tag and keep it with the shelf map.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-white/10 bg-white/5">
                <CardContent className="flex min-h-[22rem] flex-col items-center justify-center gap-3 p-8 text-center">
                  <MapPin className="h-12 w-12 text-slate-500" />
                  <p className="text-sm text-slate-400">No bin selected for tag preview.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
