"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Clock3,
  FileUp,
  Files,
  MapPin,
  PackageSearch,
  Printer,
  RotateCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
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
import { parseInventoryCsv, type InventoryCsvPreview, type InventoryCsvRow } from "@/lib/inventory-csv";
import { type AuditAction, auditActions } from "@/lib/inventory-types";
import {
  type AuditWindowPreset,
  getAuditWindowBounds,
  normalizeAuditType,
  serializeActivityCsv,
  serializeLowStockCsv,
  serializeLocationsCsv,
  serializePartsCsv,
} from "@/lib/inventory-utils";
import type { InventoryImportSummary } from "@/lib/inventory-import-types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ReportCard =
  | {
      title: string;
      description: string;
      icon: ReactNode;
      actionLabel: string;
      disabled: boolean;
      onClick: () => void;
      href?: never;
    }
  | {
      title: string;
      description: string;
      icon: ReactNode;
      actionLabel: string;
      disabled: boolean;
      href: string;
      onClick?: never;
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

export function ImportExportPage() {
  const { permissions } = useAuth();
  const { activity, bins, models, parts, settings, refreshInventory, dataSource } = useInventory();
  const [preview, setPreview] = useState<InventoryCsvPreview>({
    rows: [],
    totalRows: 0,
    readyRows: 0,
    skippedRows: 0,
    warningCount: 0,
    errorCount: 0,
  });
  const [rawText, setRawText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [importResult, setImportResult] = useState<InventoryImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [activityWindowPreset, setActivityWindowPreset] = useState<AuditWindowPreset>("last-7-days");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedAuditTypes, setSelectedAuditTypes] = useState<AuditAction[]>([]);

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
  const activityWindowBounds = useMemo(
    () =>
      getAuditWindowBounds(activityWindowPreset, {
        customStart,
        customEnd,
      }),
    [activityWindowPreset, customEnd, customStart],
  );
  const filteredActivity = useMemo(() => {
    const selectedTypes = new Set(selectedAuditTypes);

    return [...activity]
      .filter((entry) => {
        if (activityWindowBounds) {
          const occurredAt = new Date(entry.occurredAt);
          if (occurredAt < activityWindowBounds.start || occurredAt > activityWindowBounds.end) {
            return false;
          }
        }

        if (selectedTypes.size > 0 && !selectedTypes.has(normalizeAuditType(entry))) {
          return false;
        }

        return true;
      })
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
  }, [activity, activityWindowBounds, selectedAuditTypes]);
  const filteredExportState = useMemo(
    () => ({ ...exportState, activity: filteredActivity }),
    [exportState, filteredActivity],
  );
  const toggleAuditType = (auditType: AuditAction) => {
    setSelectedAuditTypes((current) =>
      current.includes(auditType)
        ? current.filter((item) => item !== auditType)
        : [...current, auditType],
    );
  };

  const reportCards: ReportCard[] = [
    {
      title: "Export Parts CSV",
      description: "Download the full inventory list with quantities, locations, and compatibility data.",
      icon: <Files className="h-5 w-5" />,
      actionLabel: "Download CSV",
      disabled: !permissions.canExportReports,
      onClick: () => downloadCsv("green-nventory-parts.csv", serializePartsCsv(exportState)),
    },
    {
      title: "Export Low Stock Report",
      description: "Pull only the parts that are at or below reorder levels.",
      icon: <AlertTriangle className="h-5 w-5" />,
      actionLabel: "Download CSV",
      disabled: !permissions.canExportReports,
      onClick: () => downloadCsv("green-nventory-low-stock.csv", serializeLowStockCsv(exportState)),
    },
    {
      title: "Export Locations Report",
      description: "Save the current bin map with status, shelf, and area details.",
      icon: <MapPin className="h-5 w-5" />,
      actionLabel: "Download CSV",
      disabled: !permissions.canExportReports,
      onClick: () => downloadCsv("green-nventory-locations.csv", serializeLocationsCsv(exportState)),
    },
    {
      title: "Export Activity Report",
      description: `Export ${filteredActivity.length} filtered activity row${filteredActivity.length === 1 ? "" : "s"} from the selected audit window.`,
      icon: <Clock3 className="h-5 w-5" />,
      actionLabel: "Download CSV",
      disabled: !permissions.canExportReports,
      onClick: () => downloadCsv("green-nventory-activity.csv", serializeActivityCsv(filteredExportState)),
    },
    {
      title: "Print Part Labels",
      description: "Open the label workflow with part tags selected as the starting point.",
      icon: <Printer className="h-5 w-5" />,
      actionLabel: "Open workflow",
      disabled: !permissions.canPrintLabels,
      href: "/tags?mode=part",
    },
    {
      title: "Print Bin Labels",
      description: "Open the label workflow with bin tags selected as the starting point.",
      icon: <Printer className="h-5 w-5" />,
      actionLabel: "Open workflow",
      disabled: !permissions.canPrintLabels,
      href: "/tags?mode=bin",
    },
  ];

  const parseCurrentText = () => {
    try {
      const parsed = parseInventoryCsv(rawText);
      setPreview(parsed);
      setPreviewError("");
      setImportResult(null);
      toast.success(`Parsed ${parsed.readyRows} ready row${parsed.readyRows === 1 ? "" : "s"}.`);
    } catch (error) {
      setPreview({
        rows: [],
        totalRows: 0,
        readyRows: 0,
        skippedRows: 0,
        warningCount: 0,
        errorCount: 0,
      });
      setPreviewError(error instanceof Error ? error.message : "Failed to parse CSV.");
      toast.error(error instanceof Error ? error.message : "Failed to parse CSV.");
    }
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setSourceName(file.name);
    const text = await file.text();
    setRawText(text);
    try {
      const parsed = parseInventoryCsv(text);
      setPreview(parsed);
      setPreviewError("");
      setImportResult(null);
      toast.success(`Parsed ${parsed.readyRows} ready row${parsed.readyRows === 1 ? "" : "s"}.`);
    } catch (error) {
      setPreview({
        rows: [],
        totalRows: 0,
        readyRows: 0,
        skippedRows: 0,
        warningCount: 0,
        errorCount: 0,
      });
      setPreviewError(error instanceof Error ? error.message : "Failed to parse CSV.");
      toast.error(error instanceof Error ? error.message : "Failed to parse CSV.");
    }
  };

  const runImport = async () => {
    if (!permissions.canImportCsv) {
      toast.error("Your current role cannot import CSV files.");
      return;
    }

    if (!rawText.trim()) {
      toast.error("Parse a CSV file or paste CSV text before importing.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/inventory/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          csvText: rawText,
          sourceName: sourceName || undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; summary?: InventoryImportSummary; message?: string }
        | null;

      if (!response.ok || !payload?.ok || !payload.summary) {
        throw new Error(payload?.message ?? "The CSV import failed.");
      }

      setImportResult(payload.summary);
      setPreviewError("");
      toast.success(
        `Imported ${payload.summary.partsCreated + payload.summary.partsUpdated} part row${
          payload.summary.partsCreated + payload.summary.partsUpdated === 1 ? "" : "s"
        } into Supabase.`,
      );
      await refreshInventory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The CSV import failed.";
      setPreviewError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Reports & Exports"
        title="Clean action cards for the jobs managers and technicians use most."
        description="Export reports, open the print workflow, and import CSV data into the live workspace."
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
            <Link
              href="/tags"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-amber-400 text-slate-950 hover:bg-amber-300",
              )}
            >
              <Printer className="mr-2 h-4 w-4" />
              Labels
            </Link>
          </>
        }
      />

      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
        {exportSummary.map((metric) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            hint="Current inventory totals"
            icon={<Files className="h-5 w-5" />}
          />
        ))}
        <StatCard
          label="Data source"
          value={dataSource === "supabase" ? "Supabase" : "Local workspace"}
          hint={
            dataSource === "supabase"
              ? "Reads from live tables when Supabase is configured."
              : "Uses browser-local workspace data."
          }
          icon={<Upload className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((card) => (
          <Card key={card.title} className="border-white/10 bg-white/5">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white">
                  {card.icon}
                </div>
                <div>
                  <CardTitle className="text-white">{card.title}</CardTitle>
                  <CardDescription className="text-slate-400">{card.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {card.href ? (
                <Link
                  href={card.href}
                  aria-disabled={card.disabled}
                  tabIndex={card.disabled ? -1 : 0}
                  className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "h-11 w-full",
                    card.disabled
                      ? "pointer-events-none bg-slate-700 text-slate-300 opacity-60"
                      : "bg-amber-400 text-slate-950 hover:bg-amber-300",
                  )}
                >
                  {card.actionLabel}
                </Link>
              ) : (
                <Button
                  className={cn(
                    "h-11 w-full",
                    card.disabled
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-300"
                      : "bg-amber-400 text-slate-950 hover:bg-amber-300",
                  )}
                  onClick={card.onClick}
                  disabled={card.disabled}
                >
                  {card.actionLabel}
                </Button>
              )}
              {card.disabled && (
                <p className="mt-3 text-xs text-slate-400">
                  {card.title.includes("Print")
                    ? "Printing is available to admins and managers only."
                    : "Exports are available to admins and managers."}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Activity export filters</CardTitle>
          <CardDescription className="text-slate-400">
            Choose the audit window and event types that should feed the activity export.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[260px_1fr]">
            <div className="space-y-2">
              <Label className="text-slate-200">Date window</Label>
              <Select
                value={activityWindowPreset}
                onValueChange={(value) => setActivityWindowPreset(value as AuditWindowPreset)}
              >
                <SelectTrigger className="h-12 border-white/10 bg-slate-950/70 text-white">
                  <SelectValue placeholder="Last 7 days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This week</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="last-7-days">Last 7 days</SelectItem>
                  <SelectItem value="this-month">This month</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="last-30-days">Last 30 days</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Included audit types</Label>
              <div className="flex flex-wrap gap-2">
                {auditActions.map((auditType) => {
                  const active = selectedAuditTypes.includes(auditType);

                  return (
                    <Button
                      key={auditType}
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-10 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                        active && "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
                      )}
                      onClick={() => toggleAuditType(auditType)}
                    >
                      {auditType.replace(/_/g, " ")}
                    </Button>
                  );
                })}
                {selectedAuditTypes.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => setSelectedAuditTypes([])}
                  >
                    Clear types
                  </Button>
                )}
              </div>
            </div>
          </div>

          {activityWindowPreset === "custom" && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-200">Custom start</Label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Custom end</Label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="h-12 border-white/10 bg-slate-950/70 text-white"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <Badge className="border-white/10 bg-white/5 text-slate-200">
              {filteredActivity.length} activity row{filteredActivity.length === 1 ? "" : "s"}
            </Badge>
            <Badge className="border-white/10 bg-white/5 text-slate-200">
              {selectedAuditTypes.length > 0 ? selectedAuditTypes.length : auditActions.length} type
              {selectedAuditTypes.length === 1 ? "" : "s"}
            </Badge>
            <span className="text-xs text-slate-500">
              The export card above will download only the rows that match these filters.
            </span>
          </div>
        </CardContent>
      </Card>

      {!permissions.canImportCsv && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4 text-sm text-slate-300">
            CSV import is available to admins and managers only.
          </CardContent>
        </Card>
      )}

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
                  Paste CSV text or pick a file. The parser matches common part, location, quantity, and compatibility columns.
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
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                  placeholder="Paste a CSV export here if you do not want to upload a file."
                  className="min-h-72 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />

                {previewError && (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                    {previewError}
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
                    disabled={busy || !permissions.canImportCsv || !rawText.trim()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Import {preview.readyRows || ""}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setRawText("");
                      setSourceName("");
                      setPreview({
                        rows: [],
                        totalRows: 0,
                        readyRows: 0,
                        skippedRows: 0,
                        warningCount: 0,
                        errorCount: 0,
                      });
                      setPreviewError("");
                      setImportResult(null);
                    }}
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
                  The parser does a few helpful matches before writing anything into Supabase.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  Bin codes are matched against the current location map. Unknown bins create new locations when needed.
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  Compatible model names may be separated by commas, semicolons, or pipes.
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  Universal rows stay universal even if no compatible models are listed.
                </div>
                <Badge className="border-white/10 bg-white/5 text-slate-200">
                  {preview.readyRows} ready rows
                </Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Total rows", value: preview.totalRows },
              { label: "Ready rows", value: preview.readyRows },
              { label: "Skipped rows", value: preview.skippedRows },
              { label: "Warnings", value: preview.warningCount },
              { label: "Errors", value: preview.errorCount },
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
              </div>
            ))}
          </div>

          {importResult && (
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Import results</CardTitle>
                <CardDescription className="text-slate-400">
                  These counts reflect what was actually written to Supabase.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Parts created", value: importResult.partsCreated },
                  { label: "Parts updated", value: importResult.partsUpdated },
                  { label: "Locations created", value: importResult.locationsCreated },
                  { label: "Locations updated", value: importResult.locationsUpdated },
                  { label: "Models created", value: importResult.modelsCreated },
                  { label: "Models updated", value: importResult.modelsUpdated },
                  { label: "Links created", value: importResult.linksCreated },
                  { label: "Transactions", value: importResult.transactionsCreated },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Preview</CardTitle>
              <CardDescription className="text-slate-400">
                Review the first few rows before importing the whole file.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto p-0">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-slate-950/60 text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Row</th>
                    <th className="px-4 py-3 font-medium">Part number</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Manufacturer</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Compatibility</th>
                    <th className="px-4 py-3 font-medium">Warnings</th>
                    <th className="px-4 py-3 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 8).map((row: InventoryCsvRow) => (
                    <tr key={row.rowIndex} className="border-t border-white/10">
                      <td className="px-4 py-3 text-slate-400">{row.rowIndex}</td>
                      <td className="px-4 py-3 font-mono text-white">
                        {row.isNpn ? "NPN" : row.partNumber || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-200">{row.partName}</td>
                      <td className="px-4 py-3 text-slate-300">{row.manufacturer}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.locationCode || "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{row.quantityOnHand}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.universal ? "Universal" : row.compatibleModelNames.join(", ") || "None"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.warnings.length > 0 ? row.warnings.join(" • ") : "None"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.errors.length > 0 ? row.errors.join(" • ") : "None"}
                      </td>
                    </tr>
                  ))}
                  {preview.rows.length === 0 && (
                    <tr>
                      <td className="px-4 py-10 text-center text-slate-400" colSpan={9}>
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
                "Description",
                "Manufacturer",
                "Category",
                "Quantity",
                "Quantity On Hand",
                "Qty",
                "Storage Bin",
                "Location",
                "Area",
                "Shelf",
                "Bin",
                "Compatible Models",
                "Models",
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
                You can hand these files to spreadsheets or save them for records and review.
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
                Activity exports preserve the event trail for audits and historical review.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
