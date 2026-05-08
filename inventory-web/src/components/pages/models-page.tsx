"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Boxes, Layers3, PackageSearch, Sparkles } from "lucide-react";

import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { countCompatiblePartsForModel } from "@/lib/inventory-utils";

export function ModelsPage() {
  const { models, parts } = useInventory();
  const [query, setQuery] = useState("");
  const [manufacturer, setManufacturer] = useState("all");

  const manufacturerOptions = useMemo(
    () => Array.from(new Set(models.map((model) => model.manufacturer))).sort(),
    [models],
  );

  const filteredModels = useMemo(() => {
    const search = query.trim().toLowerCase();
    return models.filter((model) => {
      if (manufacturer !== "all" && model.manufacturer !== manufacturer) return false;
      if (!search) return true;
      return `${model.manufacturer} ${model.name} ${model.series} ${model.status} ${model.notes ?? ""}`
        .toLowerCase()
        .includes(search);
    });
  }, [manufacturer, models, query]);

  const activeCount = models.filter((model) => model.status === "active").length;
  const legacyCount = models.filter((model) => model.status === "legacy").length;
  const compatiblePartTotal = parts.filter((part) => part.compatibleModelIds.length > 0).length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Models"
        title="Compatibility catalog for printers and copiers."
        description="Use this admin view to check which devices are active, which are legacy, and how many parts are already linked to each model."
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
              href="/lookup"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-amber-400 text-slate-950 hover:bg-amber-300",
              )}
            >
              <Boxes className="mr-2 h-4 w-4" />
              Lookup
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Models"
          value={models.length}
          hint="Fleet records"
          icon={<Boxes className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={activeCount}
          hint="Current fleet support"
          icon={<Sparkles className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Legacy"
          value={legacyCount}
          hint="Older installed units"
          icon={<Layers3 className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Parts linked"
          value={compatiblePartTotal}
          hint="Have compatibility data"
          icon={<PackageSearch className="h-5 w-5" />}
          tone="sky"
        />
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search</p>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search manufacturer, model name, series, or note"
              className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Manufacturer</p>
            <Select value={manufacturer} onValueChange={(value) => setManufacturer(value ?? "all")}>
              <SelectTrigger className="border-white/10 bg-slate-950/70 text-white">
                <SelectValue placeholder="All manufacturers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All manufacturers</SelectItem>
                {manufacturerOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-0">
          <div className="hidden overflow-hidden rounded-[inherit] lg:block">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-slate-400">Model</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Linked parts</TableHead>
                  <TableHead className="text-slate-400">Series</TableHead>
                  <TableHead className="text-slate-400">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.map((model) => {
                  const compatibleCount = countCompatiblePartsForModel(parts, model.id);
                  return (
                    <TableRow key={model.id} className="border-white/10 hover:bg-white/5">
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">
                            {model.manufacturer} {model.name}
                          </p>
                          <p className="text-xs text-slate-400">{model.series}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border",
                            model.status === "legacy"
                              ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
                          )}
                        >
                          {model.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="border-white/10 bg-white/5 text-slate-200">
                          {compatibleCount} parts
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">{model.series}</TableCell>
                      <TableCell className="text-slate-400">{model.notes || "No notes on file."}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 p-3 lg:hidden">
            {filteredModels.map((model) => {
              const compatibleCount = countCompatiblePartsForModel(parts, model.id);
              return (
                <Card key={model.id} className="border-white/10 bg-slate-950/70">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {model.manufacturer} {model.name}
                        </p>
                        <p className="text-xs text-slate-400">{model.series}</p>
                      </div>
                      <Badge
                        className={cn(
                          "border",
                          model.status === "legacy"
                            ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
                        )}
                      >
                        {model.status}
                      </Badge>
                    </div>
                    <Badge className="border-white/10 bg-white/5 text-slate-200">
                      {compatibleCount} parts linked
                    </Badge>
                    <p className="text-xs text-slate-400">{model.notes || "No notes on file."}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Compatibility insight</CardTitle>
            <CardDescription className="text-slate-400">
              A model can map to multiple parts, and those links will later migrate cleanly into Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
              Active models stay in the current fleet list and are the default target for new parts.
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
              Legacy models are preserved so older installed machines still resolve correctly in the lookup screen.
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Next step</CardTitle>
            <CardDescription className="text-slate-400">
              Use the table filters to narrow the compatibility list, then jump back into the inventory table.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link
              href="/inventory"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              Browse parts
            </Link>
            <Link
              href="/tags"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              Print tags
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
