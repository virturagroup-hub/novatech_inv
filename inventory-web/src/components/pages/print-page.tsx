"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, MapPin, PackageSearch, Printer, Tag } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Bin, Part } from "@/lib/inventory-types";
import { buildAbsoluteAppUrl } from "@/lib/navigation";
import {
  LABELS_PER_SHEET,
  normalizePrintCopies,
  parseIdList,
  type LabelMode,
} from "@/lib/labels";
import { getBinById } from "@/lib/inventory-utils";

type PrintLabel =
  | {
      type: "part";
      part: Part;
    }
  | {
      type: "bin";
      bin: Bin;
    };

function getBinLocationText(bin: Bin) {
  return `${bin.aisle}-${bin.row}-${bin.column}`;
}

function buildPartLabels(
  parts: Part[],
  mode: LabelMode,
  copies: number,
  includeZero: boolean,
) {
  if (!parts.length) {
    return [] as PrintLabel[];
  }

  if (mode === "copies") {
    return parts.flatMap((part) =>
      Array.from({ length: copies }, () => ({ type: "part" as const, part })),
    );
  }

  if (mode === "quantity") {
    return parts.flatMap((part) => {
      const repeatCount = part.quantityOnHand > 0 ? part.quantityOnHand : includeZero ? 1 : 0;
      return Array.from({ length: repeatCount }, () => ({ type: "part" as const, part }));
    });
  }

  return parts.map((part) => ({ type: "part" as const, part }));
}

function buildBinLabels(bin: Bin, copies: number) {
  return Array.from({ length: copies }, () => ({ type: "bin" as const, bin }));
}

export function PrintPage({
  searchParams,
}: Readonly<{
  searchParams: {
    partId?: string;
    partIds?: string;
    binId?: string;
    copies?: string;
    labelMode?: string;
    includeZero?: string;
  };
}>) {
  const { permissions } = useAuth();
  const { bins, getDisplayPartNumber, getPartById, recordLabelPrint } = useInventory();

  const selectedPartIds = useMemo(
    () => parseIdList(searchParams.partIds ?? searchParams.partId),
    [searchParams.partId, searchParams.partIds],
  );

  const selectedParts = useMemo(
    () =>
      selectedPartIds
        .map((partId) => getPartById(partId))
        .filter((part): part is Part => Boolean(part)),
    [getPartById, selectedPartIds],
  );

  const selectedBin = useMemo(
    () => (searchParams.binId ? getBinById(bins, searchParams.binId) : null),
    [bins, searchParams.binId],
  );

  const labelMode: LabelMode =
    searchParams.labelMode === "copies" || searchParams.labelMode === "quantity"
      ? searchParams.labelMode
      : "each";

  const copies = normalizePrintCopies(searchParams.copies ?? 1, 1);
  const includeZero = searchParams.includeZero === "1" || searchParams.includeZero === "true";

  const labels = useMemo<PrintLabel[]>(() => {
    if (selectedParts.length > 0) {
      return buildPartLabels(selectedParts, labelMode, copies, includeZero);
    }

    if (selectedBin) {
      return buildBinLabels(selectedBin, copies);
    }

    return [];
  }, [copies, includeZero, labelMode, selectedBin, selectedParts]);

  const mode: "part" | "bin" | null = selectedParts.length > 0 ? "part" : selectedBin ? "bin" : null;
  const sheetCount = labels.length > 0 ? Math.ceil(labels.length / LABELS_PER_SHEET) : 0;
  const selectedSummary =
    mode === "part"
      ? `${selectedParts.length} part${selectedParts.length === 1 ? "" : "s"} selected`
      : selectedBin
        ? `Bin ${selectedBin.code}`
        : "No selection";
  const queueSummary =
    labels.length === 1 ? "1 label queued" : `${labels.length} labels queued`;

  const handlePrint = () => {
    if (mode === "part" && selectedParts.length > 0) {
      recordLabelPrint(
        selectedParts.map((part) => part.id),
        {
          labelMode,
          copies,
          includeZero,
        },
      );
    }

    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 print:bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 print:max-w-none print:px-0 print:py-0">
        <Card className="print:hidden border-slate-200 bg-white shadow-lg">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Printable labels</p>
                <CardTitle className="text-slate-950">Green NVentory</CardTitle>
                <CardDescription className="text-slate-600">
                  Clean scan labels that open the inventory record after the QR code is scanned.
                </CardDescription>
              </div>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handlePrint}
                disabled={!permissions.canPrintLabels || labels.length === 0}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print now
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-emerald-100 text-emerald-800">{selectedSummary}</Badge>
              <Badge className="bg-slate-100 text-slate-700">{queueSummary}</Badge>
              {mode === "part" && (
                <Badge className="bg-slate-100 text-slate-700">
                  {labelMode === "each"
                    ? "One each"
                    : labelMode === "copies"
                      ? `Copies x ${copies}`
                      : includeZero
                        ? "Quantity mode with zero override"
                        : "Quantity mode"}
                </Badge>
              )}
            </div>
            {!permissions.canPrintLabels && (
              <CardDescription className="text-amber-700">
                Your current role can preview labels, but printing is restricted.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
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
          </CardContent>
        </Card>

        {!labels.length ? (
          <Card className="border-dashed border-slate-300 bg-white shadow-sm">
            <CardContent className="flex min-h-[28rem] flex-col items-center justify-center gap-4 p-8 text-center">
              <Tag className="h-12 w-12 text-slate-400" />
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-950">Choose a part or bin label</h2>
                <p className="max-w-xl text-sm text-slate-600">
                  Open the label builder, select one or more parts, then print the clean scan labels.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href="/tags"
                  className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "bg-emerald-600 text-white hover:bg-emerald-700",
                  )}
                >
                  Label builder
                </Link>
                <Link
                  href="/inventory"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950",
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
            {Array.from({ length: sheetCount }, (_, sheetIndex) => {
              const pageLabels = labels.slice(
                sheetIndex * LABELS_PER_SHEET,
                (sheetIndex + 1) * LABELS_PER_SHEET,
              );

              return (
                <section
                  key={sheetIndex}
                  className="print-sheet overflow-hidden rounded-[0.75rem] border border-slate-300 bg-white p-1 shadow-lg shadow-slate-200/60 print:break-after-page print:rounded-none print:border-0 print:p-0 print:shadow-none"
                >
                  <div className="grid grid-cols-2 gap-1 print:gap-1">
                    {Array.from({ length: LABELS_PER_SHEET }, (_, slotIndex) => {
                      const label = pageLabels[slotIndex];

                      if (!label) {
                        return <EmptyLabelSlot key={`${sheetIndex}-${slotIndex}`} />;
                      }

                      return label.type === "part" ? (
                        <PartLabelCard
                          key={`${sheetIndex}-${slotIndex}`}
                          part={label.part}
                          displayPartNumber={getDisplayPartNumber(label.part)}
                          bins={bins}
                        />
                      ) : (
                        <BinLabelCard key={`${sheetIndex}-${slotIndex}`} bin={label.bin} />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <style jsx global>{`
        @page {
          size: letter;
          margin: 0.12in;
        }

        @media print {
          html,
          body {
            background: white !important;
          }

          .print-sheet {
            break-after: page;
            page-break-after: always;
          }

          .print-sheet:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}

function PartLabelCard({
  part,
  displayPartNumber,
  bins,
}: Readonly<{
  part: Part;
  displayPartNumber: string;
  bins: Bin[];
}>) {
  const bin = getBinById(bins, part.binId);
  const locationText = bin ? `${bin.code} · ${getBinLocationText(bin)}` : "Unassigned";
  const qrValue = buildAbsoluteAppUrl(`/inventory/${part.id}`);

  return (
    <div className="flex h-[2in] flex-col justify-between overflow-hidden rounded-lg border border-slate-300 bg-white p-1.5 text-slate-950 print:border-slate-300">
      <div className="flex justify-center">
        <QRCodeSVG
          value={qrValue}
          includeMargin
          size={92}
          className="rounded-lg bg-white p-1"
        />
      </div>
      <div className="mt-2 space-y-0.5 text-center">
        <p className="font-mono text-[13px] font-semibold leading-4">{displayPartNumber}</p>
        <p className="text-[11px] font-medium leading-4">{part.partName}</p>
        <p className="text-[10px] leading-4 text-slate-700">{locationText}</p>
      </div>
    </div>
  );
}

function BinLabelCard({
  bin,
}: Readonly<{
  bin: Bin;
}>) {
  const qrValue = buildAbsoluteAppUrl(`/locations/${bin.id}`);
  const locationText = getBinLocationText(bin);

  return (
    <div className="flex h-[2in] flex-col justify-between overflow-hidden rounded-lg border border-slate-300 bg-white p-1.5 text-slate-950 print:border-slate-300">
      <div className="flex justify-center">
        <QRCodeSVG
          value={qrValue}
          includeMargin
          size={92}
          className="rounded-lg bg-white p-1"
        />
      </div>
      <div className="mt-2 space-y-0.5 text-center">
        <p className="font-mono text-[13px] font-semibold leading-4">{bin.code}</p>
        <p className="text-[11px] font-medium leading-4">{locationText}</p>
        {bin.description ? (
          <p className="text-[10px] leading-4 text-slate-700">{bin.description}</p>
        ) : null}
      </div>
    </div>
  );
}

function EmptyLabelSlot() {
  return (
    <div
      aria-hidden="true"
      className="h-[2in] rounded-lg border border-dashed border-slate-200 bg-slate-50/40 print:border-0 print:bg-transparent"
    />
  );
}
