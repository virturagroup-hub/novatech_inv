"use client";

import Link from "next/link";
import { ArrowLeft, Boxes, Edit3, PackageSearch, ScanSearch } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { countCompatiblePartsForModel, formatCompactDate, getPartStockStatus } from "@/lib/inventory-utils";

export function ModelDetailPage({ modelId }: Readonly<{ modelId: string }>) {
  const { permissions } = useAuth();
  const { models, parts, getDisplayPartNumber } = useInventory();

  const model = models.find((item) => item.id === modelId);

  if (!model) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <PageHero
          eyebrow="Model detail"
          title="That model is not in the current inventory."
          description="Open the model list or use lookup to find a different compatibility record."
          actions={
            <>
              <Link
                href="/models"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to models
              </Link>
              <Link
                href="/lookup"
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
                )}
              >
                <ScanSearch className="mr-2 h-4 w-4" />
                Lookup parts
              </Link>
            </>
          }
        />
      </div>
    );
  }

  const compatibleParts = [...parts]
    .filter((part) => part.compatibleModelIds.includes(model.id))
    .sort((left, right) => {
      const partNumberComparison = getDisplayPartNumber(left).localeCompare(getDisplayPartNumber(right));
      return partNumberComparison || right.updatedAt.localeCompare(left.updatedAt);
    });
  const lowStockCount = compatibleParts.filter((part) => getPartStockStatus(part) !== "healthy").length;
  const universalCount = compatibleParts.filter((part) => part.universal).length;

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Models"
        title={`${model.manufacturer} ${model.name}`}
        description={`${model.series || "No series listed"} · ${model.status === "active" ? "Active" : "Inactive"} compatibility record. ${compatibleParts.length} compatible parts are linked to this model.`}
        actions={
          <>
            <Link
              href="/models"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Models
            </Link>
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
            {permissions.canManageModels && (
              <Link
                href={`/models/${model.id}/edit`}
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
                )}
              >
                <Edit3 className="mr-2 h-4 w-4" />
                Edit model
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Compatible parts"
          value={compatibleParts.length}
          hint="Linked inventory records"
          icon={<Boxes className="h-5 w-5" />}
        />
        <StatCard
          label="Low stock"
          value={lowStockCount}
          hint="Need a reorder review"
          icon={<Boxes className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Universal parts"
          value={universalCount}
          hint="Applied across the fleet"
          icon={<Boxes className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Status"
          value={model.status === "active" ? "Active" : "Inactive"}
          hint="Model record state"
          icon={<Boxes className="h-5 w-5" />}
          tone={model.status === "active" ? "emerald" : "amber"}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={
                  model.status === "inactive"
                    ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                    : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                }
              >
                {model.status === "active" ? "Active" : "Inactive"}
              </Badge>
              {compatibleParts.length > 0 && (
                <Badge className="border-sky-400/20 bg-sky-400/10 text-sky-100">
                  {countCompatiblePartsForModel(parts, model.id)} parts
                </Badge>
              )}
            </div>
            <CardTitle className="text-white">Model details</CardTitle>
            <CardDescription className="text-slate-400">
              Read-only compatibility detail for technicians and managers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Manufacturer</p>
                <p className="mt-2 text-lg font-semibold text-white">{model.manufacturer}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Series</p>
                <p className="mt-2 text-lg font-semibold text-white">{model.series || "Not listed"}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Notes</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{model.notes || "No notes on file."}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Quick actions</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/lookup"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <ScanSearch className="mr-2 h-4 w-4" />
                  Lookup parts
                </Link>
                <Link
                  href="/inventory"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  Inventory
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Compatible parts</CardTitle>
            <CardDescription className="text-slate-400">
              Parts that match this model record. Open any item to inspect the full record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {compatibleParts.length > 0 ? (
              <ScrollArea className="h-[clamp(20rem,62vh,36rem)] rounded-3xl border border-white/10 bg-slate-950/50">
                <div className="space-y-3 p-3 pr-4">
                  {compatibleParts.map((part) => (
                    <Link
                      key={part.id}
                      href={`/inventory/${part.id}`}
                      className="block rounded-3xl border border-white/10 bg-slate-950/50 p-4 transition-colors hover:bg-white/10"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold text-white">
                            {getDisplayPartNumber(part)}
                          </p>
                          <p className="mt-1 text-sm text-slate-200">{part.partName}</p>
                          <p className="mt-2 text-xs text-slate-400">
                            {part.manufacturer} · {part.category} · Updated {formatCompactDate(part.updatedAt)}
                          </p>
                        </div>
                        <Badge
                          className={
                            getPartStockStatus(part) === "critical"
                              ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
                              : getPartStockStatus(part) === "low"
                                ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                                : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                          }
                        >
                          {part.quantityOnHand}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                No compatible parts are assigned yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
