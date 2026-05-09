"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  Edit3,
  Filter,
  Plus,
  Trash2,
  PackageSearch,
  ScanSearch,
  Sparkles,
  MapPin,
  Minus,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { categories, manufacturers, type Bin, type InventorySortKey, type Part, type PartFilters } from "@/lib/inventory-types";
import {
  filterParts,
  formatCompactDate,
  getPartLocationLabel,
  getPartStockStatus,
  requiresAttention,
  sortParts,
  serializePartsCsv,
} from "@/lib/inventory-utils";

const defaultFilters: PartFilters = {
  query: "",
  manufacturer: "",
  category: "",
  binId: "",
  modelId: "",
  status: "all",
};

export function InventoryPage() {
  const { permissions } = useAuth();
  const { parts, bins, models, summary, deletePart, adjustPart, isSupabaseMode } = useInventory();
  const [filters, setFilters] = useState<PartFilters>(defaultFilters);
  const [sortKey, setSortKey] = useState<InventorySortKey>("updatedAt");

  const filteredParts = useMemo(() => {
    return sortParts(filterParts(parts, bins, models, filters), sortKey);
  }, [bins, filters, models, parts, sortKey]);

  const locationOptions = useMemo(
    () =>
      [...bins]
        .sort((left, right) => left.code.localeCompare(right.code))
        .map((bin) => ({
          value: bin.id,
          label: `${bin.code} · ${bin.name}`,
        })),
    [bins],
  );

  const modelOptions = useMemo(
    () =>
      [...models]
        .sort((left, right) => left.manufacturer.localeCompare(right.manufacturer))
        .map((model) => ({
          value: model.id,
          label: `${model.manufacturer} ${model.name}`,
        })),
    [models],
  );

  const exportParts = () => {
    if (!permissions.canExportReports) {
      toast.error("Your role cannot export reports.");
      return;
    }

    const csv = serializePartsCsv({ parts, bins, models });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `green-nventory-parts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Parts CSV exported");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Inventory management"
        title="Browse, edit, and stock reusable parts quickly."
        description="Search part numbers, filter by location or manufacturer, and make quick quantity updates from the table or phone-friendly cards."
        actions={
          <>
            <Link
              href="/lookup"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              Quick lookup
            </Link>
            {permissions.canManageParts && (
              <Link
                href="/inventory/new"
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
                )}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add part
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Parts"
          value={parts.length}
          hint={isSupabaseMode ? "Tracked in Supabase" : "Tracked locally"}
          icon={<PackageSearch className="h-5 w-5" />}
        />
        <StatCard
          label="Low stock"
          value={summary.lowStockCount}
          hint="At or below reorder point"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Unassigned"
          value={summary.unassignedCount}
          hint="Need a storage bin"
          icon={<MapPin className="h-5 w-5" />}
          tone="rose"
        />
        <StatCard
          label="Coverage"
          value={`${summary.coverage}%`}
          hint="Compatible or universal parts"
          icon={<Sparkles className="h-5 w-5" />}
          tone="emerald"
        />
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Search
              </Label>
              <div className="relative">
                <ScanSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={filters.query}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, query: event.target.value }))
                  }
                  placeholder="Part number, name, bin, model, or note"
                  className="h-12 border-white/10 bg-slate-950/70 pl-9 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Manufacturer
              </Label>
              <Select
                value={filters.manufacturer || "all"}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    manufacturer: value && value !== "all" ? value : "",
                  }))
                }
              >
                <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
                  <SelectValue placeholder="All manufacturers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All manufacturers</SelectItem>
                  {manufacturers.map((manufacturer) => (
                    <SelectItem key={manufacturer} value={manufacturer}>
                      {manufacturer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Category
              </Label>
              <Select
                value={filters.category || "all"}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    category: value && value !== "all" ? value : "",
                  }))
                }
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
              <Label className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Location
              </Label>
              <Select
                value={filters.binId || "all"}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    binId: value && value !== "all" ? value : "",
                  }))
                }
              >
                <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
                  <SelectValue placeholder="Any bin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any bin</SelectItem>
                  {locationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Model
              </Label>
              <Select
                value={filters.modelId || "all"}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    modelId: value && value !== "all" ? value : "",
                  }))
                }
              >
                <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
                  <SelectValue placeholder="Any model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any model</SelectItem>
                  {modelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Stock status
              </Label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    status: value as PartFilters["status"],
                  }))
                }
              >
                <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="low">Low stock</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="attention">Attention needed</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="universal">Universal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Sort by
              </Label>
              <Select
                value={sortKey}
                onValueChange={(value) => setSortKey(value as InventorySortKey)}
              >
                <SelectTrigger className="h-12 w-full border-white/10 bg-slate-950/70 text-white">
                  <SelectValue placeholder="Updated" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updatedAt">Recently updated</SelectItem>
                  <SelectItem value="partNumber">Part number</SelectItem>
                  <SelectItem value="quantity">Quantity</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                className="h-12 flex-1 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={() => setFilters(defaultFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Reset
              </Button>
              {permissions.canExportReports && (
                <Button
                  variant="outline"
                  className="h-12 flex-1 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                  onClick={exportParts}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { label: "Results", value: filteredParts.length },
          {
            label: "Selected low stock",
            value: filteredParts.filter((part) => getPartStockStatus(part) !== "healthy").length,
          },
          {
            label: "Attention",
            value: filteredParts.filter((part) => requiresAttention(part)).length,
          },
        ].map((metric) => (
          <Card key={metric.label} className="border-white/10 bg-white/5">
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                {metric.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-0">
          <div className="hidden lg:block">
            <ScrollArea className="h-[clamp(24rem,62vh,44rem)] rounded-[inherit]">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableHead className="text-slate-400">Part</TableHead>
                    <TableHead className="text-slate-400">Location</TableHead>
                    <TableHead className="text-slate-400">Qty</TableHead>
                    <TableHead className="text-slate-400">Compatibility</TableHead>
                    <TableHead className="text-slate-400">Updated</TableHead>
                    <TableHead className="text-right text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParts.map((part) => (
                    <InventoryTableRow
                      key={part.id}
                      part={part}
                      bins={bins}
                      canAdjustStock={permissions.canAdjustStock}
                      canManageParts={permissions.canManageParts}
                      onDelete={() => {
                        if (
                          window.confirm(
                            `Delete ${part.partNumber}? This will remove the part from the inventory.`,
                          )
                        ) {
                          deletePart(part.id);
                          toast.success("Part removed");
                        }
                      }}
                      onAdjust={(delta) => adjustPart(part.id, delta)}
                    />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          <ScrollArea className="lg:hidden h-[clamp(24rem,65vh,44rem)]">
            <div className="space-y-3 p-3">
              {filteredParts.map((part) => (
                <InventoryMobileCard
                  key={part.id}
                  part={part}
                  bins={bins}
                  canAdjustStock={permissions.canAdjustStock}
                  canManageParts={permissions.canManageParts}
                  onDelete={() => {
                    if (
                      window.confirm(
                        `Delete ${part.partNumber}? This will remove the part from the inventory.`,
                      )
                    ) {
                      deletePart(part.id);
                      toast.success("Part removed");
                    }
                  }}
                  onAdjust={(delta) => adjustPart(part.id, delta)}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {filteredParts.length === 0 && (
        <Card className="border-dashed border-white/10 bg-white/5">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <PackageSearch className="h-12 w-12 text-slate-500" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">
                {parts.length === 0 ? "No parts found yet" : "No matching parts"}
              </h3>
              <p className="max-w-xl text-sm text-slate-400">
                {parts.length === 0
                  ? "Import a CSV or add your first part."
                  : "Try a different search or clear the filters to bring the inventory back into view."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                onClick={() => setFilters(defaultFilters)}
              >
                {parts.length === 0 ? "Refresh view" : "Clear filters"}
              </Button>
              {parts.length === 0 && permissions.canImportCsv && (
                <Link
                  href="/import-export"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  Import CSV
                </Link>
              )}
              {parts.length === 0 && permissions.canManageParts && (
                <Link
                  href="/inventory/new"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  Add first part
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InventoryTableRow({
  part,
  bins,
  canAdjustStock,
  canManageParts,
  onDelete,
  onAdjust,
}: {
  part: Part;
  bins: Bin[];
  canAdjustStock: boolean;
  canManageParts: boolean;
  onDelete: () => void;
  onAdjust: (delta: number) => void;
}) {
  const stockStatus = getPartStockStatus(part);
  const compatibility = part.universal ? "Universal" : `${part.compatibleModelIds.length} models`;
  const attention = requiresAttention(part);

  return (
    <TableRow className="border-white/10 hover:bg-white/5">
      <TableCell>
        <div className="space-y-1">
          <Link
            href={`/inventory/${part.id}`}
            className="font-mono text-sm font-semibold text-white hover:text-emerald-300"
          >
            {part.partNumber}
          </Link>
          <p className="text-sm text-slate-300">{part.partName}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-white/10 bg-white/5 text-slate-200">
              {part.manufacturer}
            </Badge>
            <Badge className="border-white/10 bg-white/5 text-slate-200">
              {part.category}
            </Badge>
            {attention && (
              <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-200">
                Attention
              </Badge>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-slate-300">{getPartLocationLabel(part, bins)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
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
            {part.quantityOnHand}
          </Badge>
          {canAdjustStock && (
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={() => onAdjust(-1)}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                onClick={() => onAdjust(1)}
              >
                <PlusCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-slate-300">{compatibility}</TableCell>
      <TableCell className="text-slate-400">{formatCompactDate(part.updatedAt)}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/inventory/${part.id}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "text-slate-300 hover:bg-white/10 hover:text-white",
            )}
          >
            <PackageSearch className="h-4 w-4" />
          </Link>
          {canManageParts && (
            <Link
              href={`/inventory/${part.id}/edit`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <Edit3 className="h-4 w-4" />
            </Link>
          )}
          {canManageParts && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function InventoryMobileCard({
  part,
  bins,
  canAdjustStock,
  canManageParts,
  onDelete,
  onAdjust,
}: {
  part: Part;
  bins: Bin[];
  canAdjustStock: boolean;
  canManageParts: boolean;
  onDelete: () => void;
  onAdjust: (delta: number) => void;
}) {
  const stockStatus = getPartStockStatus(part);

  return (
    <Card className="border-white/10 bg-slate-950/70">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/inventory/${part.id}`} className="font-mono text-sm font-semibold text-white hover:text-emerald-300">
              {part.partNumber}
            </Link>
            <p className="mt-1 truncate text-sm text-slate-300">{part.partName}</p>
            <p className="mt-1 text-xs text-slate-400">
              {getPartLocationLabel(part, bins)}
            </p>
          </div>
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
            {part.quantityOnHand}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className="border-white/10 bg-white/5 text-slate-200">{part.manufacturer}</Badge>
          <Badge className="border-white/10 bg-white/5 text-slate-200">{part.category}</Badge>
          {requiresAttention(part) && (
            <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-200">
              Attention
            </Badge>
          )}
        </div>

        {canAdjustStock && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-11 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => onAdjust(-1)}
            >
              <Minus className="mr-2 h-4 w-4" />
              -1
            </Button>
            <Button
              variant="outline"
              className="h-11 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => onAdjust(1)}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              +1
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/inventory/${part.id}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "h-11 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
            )}
          >
            Details
          </Link>
          {canManageParts && (
            <Link
              href={`/inventory/${part.id}/edit`}
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "h-11 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <Edit3 className="mr-2 h-4 w-4" />
              Edit
            </Link>
          )}
          {canManageParts && (
            <Button
              variant="outline"
              className="h-11 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

