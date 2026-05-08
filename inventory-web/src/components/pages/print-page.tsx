"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Printer, Tag, MapPin, PackageSearch } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_SUBTITLE, COMPANY_NAME } from "@/lib/brand";
import type { Bin, Part } from "@/lib/inventory-types";
import { getBinSummary, getPartLocationLabel, getPartStockStatus } from "@/lib/inventory-utils";

type PrintMode = "part" | "bin";

function printCopies(value: string) {
  return Math.max(1, Math.min(12, Number(value) || 1));
}

export function PrintPage({
  searchParams,
}: Readonly<{
  searchParams: {
    partId?: string;
    binId?: string;
    copies?: string;
  };
}>) {
  const { permissions } = useAuth();
  const { bins, getCompatibleModels, getPartById, parts, settings } = useInventory();
  const selectedPart = searchParams.partId ? getPartById(searchParams.partId) : null;
  const selectedBin = searchParams.binId ? bins.find((bin) => bin.id === searchParams.binId) ?? null : null;
  const [copies, setCopies] = useState(String(printCopies(searchParams.copies ?? String(settings.defaultPrintCopies))));

  useEffect(() => {
    setCopies(String(printCopies(searchParams.copies ?? String(settings.defaultPrintCopies))));
  }, [searchParams.copies, settings.defaultPrintCopies]);

  const mode: PrintMode | null = selectedPart ? "part" : selectedBin ? "bin" : null;
  const sheetCount = printCopies(copies);

  const sheets = useMemo(
    () => Array.from({ length: sheetCount }, (_, index) => index),
    [sheetCount],
  );

  const compatibleModels = selectedPart ? getCompatibleModels(selectedPart) : [];
  const selectedBinSummary = selectedBin ? getBinSummary(selectedBin, parts) : null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <Card className="print:hidden border-slate-200 bg-white shadow-lg">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Printable labels</p>
                <CardTitle className="text-slate-950">{APP_NAME}</CardTitle>
                <CardDescription className="text-slate-600">{APP_SUBTITLE}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-800">{COMPANY_NAME}</Badge>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={handlePrint}
                  disabled={!mode || !permissions.canPrintLabels}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print now
                </Button>
              </div>
            </div>
            <CardDescription className="text-slate-600">
              This route prints only labels. The app shell stays out of the way, and the preview matches the letter-sized sheet below.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div className="space-y-2">
              <Label className="text-slate-700">Copies</Label>
              <Input
                value={copies}
                onChange={(event) => setCopies(event.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                className="h-12 border-slate-300 bg-white text-slate-950"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Mode</Label>
              <Select value={mode ?? "none"} disabled>
                <SelectTrigger className="h-12 border-slate-300 bg-white text-slate-950">
                  <SelectValue placeholder="Choose a label" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="part">Part tag</SelectItem>
                  <SelectItem value="bin">Bin tag</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 lg:col-span-2">
              <Link
                href="/tags"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to labels
              </Link>
              <Link
                href="/inventory"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <PackageSearch className="mr-2 h-4 w-4" />
                Parts
              </Link>
              <Link
                href="/locations"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <MapPin className="mr-2 h-4 w-4" />
                Locations
              </Link>
            </div>
          </CardContent>
        </Card>

        {!permissions.canPrintLabels && (
          <Card className="print:hidden border-amber-300 bg-amber-50">
            <CardContent className="p-4 text-sm text-amber-900">
              Your current role can preview labels, but printing is restricted.
            </CardContent>
          </Card>
        )}

        {!mode ? (
          <Card className="border-dashed border-slate-300 bg-white shadow-sm">
            <CardContent className="flex min-h-[32rem] flex-col items-center justify-center gap-4 p-8 text-center">
              <Tag className="h-12 w-12 text-slate-400" />
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-950">Choose a part or bin to print</h2>
                <p className="max-w-xl text-sm text-slate-600">
                  Open a part tag from inventory or a bin tag from locations, then come back here to print on letter paper.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href="/inventory"
                  className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "bg-emerald-600 text-white hover:bg-emerald-700",
                  )}
                >
                  Parts
                </Link>
                <Link
                  href="/locations"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                  )}
                >
                  Locations
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sheets.map((sheetIndex) => (
              <section
                key={sheetIndex}
                className="print-sheet overflow-hidden rounded-[1rem] border border-slate-300 bg-white p-2 shadow-lg shadow-slate-200/60"
              >
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 8 }, (_, labelIndex) =>
                    mode === "part" && selectedPart ? (
                      <PartLabelCard
                        key={`${sheetIndex}-${labelIndex}`}
                        part={selectedPart}
                        locationLabel={getPartLocationLabel(selectedPart, bins)}
                        compatibleCount={compatibleModels.length}
                      />
                    ) : selectedBin ? (
                      <BinLabelCard
                        key={`${sheetIndex}-${labelIndex}`}
                        bin={selectedBin}
                        partCount={selectedBinSummary?.parts.length ?? 0}
                        lowStockCount={selectedBinSummary?.lowStockCount ?? 0}
                      />
                    ) : null,
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PartLabelCard({
  part,
  locationLabel,
  compatibleCount,
}: Readonly<{
  part: Part;
  locationLabel: string;
  compatibleCount: number;
}>) {
  return (
    <div className="flex min-h-[2.56in] flex-col justify-between rounded-xl border border-slate-300 bg-white p-3 text-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/novatech-logo.png"
              alt={`${COMPANY_NAME} logo`}
              width={28}
              height={28}
              className="rounded-md"
            />
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
              {APP_NAME}
            </p>
          </div>
          <p className="font-mono text-lg font-semibold leading-none">{part.partNumber}</p>
          <p className="text-sm font-semibold leading-5">{part.partName}</p>
        </div>
        <QRCodeSVG value={`part:${part.partNumber}`} includeMargin size={64} className="shrink-0 rounded-lg bg-white p-1" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-700">
        <div className="rounded-lg bg-slate-100 p-2">
          <p className="uppercase tracking-[0.22em] text-slate-500">Location</p>
          <p className="mt-1 font-medium text-slate-950">{locationLabel}</p>
        </div>
        <div className="rounded-lg bg-slate-100 p-2">
          <p className="uppercase tracking-[0.22em] text-slate-500">Qty</p>
          <p className="mt-1 font-medium text-slate-950">{part.quantityOnHand} on hand</p>
        </div>
        <div className="rounded-lg bg-slate-100 p-2">
          <p className="uppercase tracking-[0.22em] text-slate-500">Compatibility</p>
          <p className="mt-1 font-medium text-slate-950">
            {part.universal ? "Universal" : `${compatibleCount} models`}
          </p>
        </div>
        <div className="rounded-lg bg-slate-100 p-2">
          <p className="uppercase tracking-[0.22em] text-slate-500">Stock</p>
          <p className="mt-1 font-medium text-slate-950">{getPartStockStatus(part)}</p>
        </div>
      </div>
    </div>
  );
}

function BinLabelCard({
  bin,
  partCount,
  lowStockCount,
}: Readonly<{
  bin: Bin;
  partCount: number;
  lowStockCount: number;
}>) {
  return (
    <div className="flex min-h-[2.56in] flex-col justify-between rounded-xl border border-slate-300 bg-white p-3 text-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/novatech-logo.png"
              alt={`${COMPANY_NAME} logo`}
              width={28}
              height={28}
              className="rounded-md"
            />
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
              {APP_NAME}
            </p>
          </div>
          <p className="font-mono text-lg font-semibold leading-none">{bin.code}</p>
          <p className="text-sm font-semibold leading-5">{bin.name}</p>
        </div>
        <QRCodeSVG value={`bin:${bin.code}`} includeMargin size={64} className="shrink-0 rounded-lg bg-white p-1" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-700">
        <div className="rounded-lg bg-slate-100 p-2">
          <p className="uppercase tracking-[0.22em] text-slate-500">Area</p>
          <p className="mt-1 font-medium text-slate-950">{bin.aisle}</p>
        </div>
        <div className="rounded-lg bg-slate-100 p-2">
          <p className="uppercase tracking-[0.22em] text-slate-500">Shelf</p>
          <p className="mt-1 font-medium text-slate-950">{bin.row}</p>
        </div>
        <div className="rounded-lg bg-slate-100 p-2">
          <p className="uppercase tracking-[0.22em] text-slate-500">Bin</p>
          <p className="mt-1 font-medium text-slate-950">{bin.column}</p>
        </div>
        <div className="rounded-lg bg-slate-100 p-2">
          <p className="uppercase tracking-[0.22em] text-slate-500">Parts</p>
          <p className="mt-1 font-medium text-slate-950">
            {partCount} / {lowStockCount} low
          </p>
        </div>
      </div>
    </div>
  );
}
