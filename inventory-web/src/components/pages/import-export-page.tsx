"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Download, FileUp, Files, PackageSearch, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";

import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { categories } from "@/lib/inventory-types";
import {
  serializeActivityCsv,
  serializeBinsCsv,
  serializeModelsCsv,
  serializePartsCsv,
} from "@/lib/inventory-utils";
import { type PartImportRow } from "@/lib/inventory-reducer";

type ImportPreviewState = {
  rows: PartImportRow[];
  rawText: string;
  error: string;
};

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function readValue(row: Record<string, unknown>, aliases: string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
  );
  for (const alias of aliases) {
    const value = normalized.get(normalizeHeader(alias));
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function parseImportRows(text: string): PartImportRow[] {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }

  const rows = result.data
    .map((row) => {
      const partNumber = readValue(row, ["part number", "partnumber", "part_number"]);
      const partName = readValue(row, ["part name", "partname", "part_name"]);
      if (!partNumber || !partName) return null;

      const compatibleModelNames = readValue(row, [
        "compatible models",
        "compatible model names",
        "model names",
        "models",
      ])
        .split(/[,;|]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const categoryValue = readValue(row, ["category"]);
      const category = categories.find(
        (item) => item.toLowerCase() === categoryValue.toLowerCase(),
      ) ?? "Other";

      return {
        partNumber,
        partName,
        manufacturer: readValue(row, ["manufacturer"]),
        category,
        quantityOnHand: Number(readValue(row, ["quantity on hand", "quantity", "qty"])) || 0,
        reorderPoint: Number(readValue(row, ["reorder point", "reorder"])) || 0,
        reorderTarget: Number(readValue(row, ["reorder target", "target"])) || 0,
        binCode: readValue(row, ["bin code", "bin", "location"]),
        compatibleModelNames,
        universal: ["yes", "true", "1", "y"].includes(
          readValue(row, ["universal"]).toLowerCase(),
        ),
        notes: readValue(row, ["notes", "note"]),
      } satisfies PartImportRow;
    })
    .filter(Boolean) as PartImportRow[];

  if (rows.length === 0) {
    throw new Error("No valid part rows were found in the CSV.");
  }

  return rows;
}

export function ImportExportPage() {
  const { activity, bins, models, parts, settings, importParts } = useInventory();
  const [preview, setPreview] = useState<ImportPreviewState>({
    rows: [],
    rawText: "",
    error: "",
  });
  const [busy, setBusy] = useState(false);

  const exportSummary = useMemo(
    () => [
      { label: "Parts", value: parts.length },
      { label: "Bins", value: bins.length },
      { label: "Models", value: models.length },
      { label: "Activity", value: activity.length },
    ],
    [activity.length, bins.length, models.length, parts.length],
  );
  const exportState = useMemo(
    () => ({ parts, bins, models, activity, settings }),
    [activity, bins, models, parts, settings],
  );

  const parseCurrentText = () => {
    try {
      const rows = parseImportRows(preview.rawText);
      setPreview((current) => ({ ...current, rows, error: "" }));
      toast.success(`Parsed ${rows.length} part row${rows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setPreview((current) => ({
        ...current,
        rows: [],
        error: error instanceof Error ? error.message : "Failed to parse CSV.",
      }));
      toast.error(error instanceof Error ? error.message : "Failed to parse CSV.");
    }
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setPreview((current) => ({ ...current, rawText: text }));
    try {
      const rows = parseImportRows(text);
      setPreview({ rawText: text, rows, error: "" });
      toast.success(`Parsed ${rows.length} part row${rows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setPreview({
        rawText: text,
        rows: [],
        error: error instanceof Error ? error.message : "Failed to parse CSV.",
      });
      toast.error(error instanceof Error ? error.message : "Failed to parse CSV.");
    }
  };

  const runImport = () => {
    if (preview.rows.length === 0) {
      toast.error("Parse a CSV file or paste CSV text before importing.");
      return;
    }

    setBusy(true);
    try {
      importParts(preview.rows);
      toast.success(`Imported ${preview.rows.length} part row${preview.rows.length === 1 ? "" : "s"}.`);
      setPreview({ rows: [], rawText: "", error: "" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="CSV tools"
        title="Export the current dataset or import a clean part list."
        description="The app already speaks a Supabase-friendly shape, but this Phase 1 screen is useful for moving data in and out of the browser store right now."
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
            <Button className="bg-amber-400 text-slate-950 hover:bg-amber-300" onClick={() => downloadCsv("novatech-parts.csv", serializePartsCsv(exportState))}>
              <Download className="mr-2 h-4 w-4" />
              Export parts
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {exportSummary.map((metric) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            hint="Included in the local dataset"
            icon={<Files className="h-5 w-5" />}
          />
        ))}
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Quick exports</p>
            <p className="text-sm text-slate-300">
              Download the current mock store as CSV files that can be edited in Excel, Google Sheets, or a future import job.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => downloadCsv("novatech-parts.csv", serializePartsCsv(exportState))}
            >
              <Download className="mr-2 h-4 w-4" />
              Parts
            </Button>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => downloadCsv("novatech-bins.csv", serializeBinsCsv(exportState))}
            >
              <Download className="mr-2 h-4 w-4" />
              Bins
            </Button>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => downloadCsv("novatech-models.csv", serializeModelsCsv(exportState))}
            >
              <Download className="mr-2 h-4 w-4" />
              Models
            </Button>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => downloadCsv("novatech-activity.csv", serializeActivityCsv(exportState))}
            >
              <Download className="mr-2 h-4 w-4" />
              Activity
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList className="grid h-auto grid-cols-2 bg-white/5 p-1">
          <TabsTrigger value="import" className="data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950">
            Import parts
          </TabsTrigger>
          <TabsTrigger value="guide" className="data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950">
            CSV guide
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Import part rows</CardTitle>
                <CardDescription className="text-slate-400">
                  Paste CSV text or pick a file. The parser matches part number, name, bin code, and compatible model names.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  className="border-white/10 bg-slate-950/70 text-white"
                  onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                />
                <Textarea
                  value={preview.rawText}
                  onChange={(event) =>
                    setPreview((current) => ({ ...current, rawText: event.target.value }))
                  }
                  placeholder="Paste a CSV export here if you do not want to upload a file."
                  className="min-h-72 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />

                {preview.error && (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                    {preview.error}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={parseCurrentText}
                  >
                    <FileUp className="mr-2 h-4 w-4" />
                    Parse preview
                  </Button>
                  <Button
                    className="bg-amber-400 text-slate-950 hover:bg-amber-300"
                    onClick={runImport}
                    disabled={busy || preview.rows.length === 0}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Import {preview.rows.length || ""}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => setPreview({ rows: [], rawText: "", error: "" })}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Import rules</CardTitle>
                <CardDescription className="text-slate-400">
                  The parser does a few helpful matches before writing anything into the store.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  Bin codes are matched against the current storage map. Unknown bins fall back to unassigned.
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  Compatible model names may be separated by commas, semicolons, or pipes.
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  Universal rows stay universal even if no compatible models are listed.
                </div>
                <Badge className="border-white/10 bg-white/5 text-slate-200">
                  {preview.rows.length} parsed rows
                </Badge>
              </CardContent>
            </Card>
          </div>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Preview</CardTitle>
              <CardDescription className="text-slate-400">
                Review the first few rows before importing the whole file.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto p-0">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-950/60 text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Part number</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Manufacturer</th>
                    <th className="px-4 py-3 font-medium">Bin</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Compatibility</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 8).map((row) => (
                    <tr key={row.partNumber} className="border-t border-white/10">
                      <td className="px-4 py-3 font-mono text-white">{row.partNumber}</td>
                      <td className="px-4 py-3 text-slate-200">{row.partName}</td>
                      <td className="px-4 py-3 text-slate-300">{row.manufacturer}</td>
                      <td className="px-4 py-3 text-slate-300">{row.binCode || "Unassigned"}</td>
                      <td className="px-4 py-3 text-slate-300">{row.quantityOnHand}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.universal ? "Universal" : row.compatibleModelNames.join(", ") || "None"}
                      </td>
                    </tr>
                  ))}
                  {preview.rows.length === 0 && (
                    <tr>
                      <td className="px-4 py-10 text-center text-slate-400" colSpan={6}>
                        No parsed rows yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guide" className="space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Suggested columns</CardTitle>
              <CardDescription className="text-slate-400">
                This is the format the parser understands best today.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                "Part Number",
                "Part Name",
                "Manufacturer",
                "Category",
                "Quantity On Hand",
                "Reorder Point",
                "Reorder Target",
                "Bin Code",
                "Compatible Models",
                "Universal",
                "Notes",
              ].map((column) => (
                <div key={column} className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200">
                  {column}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">What exports include</CardTitle>
              <CardDescription className="text-slate-400">
                You can hand these files to spreadsheets or save them for the next phase of the migration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                Parts exports keep location, compatibility, and count fields intact.
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                Bin exports keep aisle, row, column, and manufacturer metadata.
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                Activity exports preserve the event trail so the next database can ingest it later.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
