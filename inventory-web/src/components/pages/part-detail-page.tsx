"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarClock,
  Edit3,
  Minus,
  MapPin,
  Package,
  Printer,
  PlusCircle,
  ScanSearch,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { buildPartPrintHref } from "@/lib/labels";
import {
  formatDateTime,
  formatRelative,
  getPartLocationLabel,
  getPartStockStatus,
  requiresAttention,
} from "@/lib/inventory-utils";

export function PartDetailPage({ partId }: Readonly<{ partId: string }>) {
  const { permissions } = useAuth();
  const {
    activity,
    bins,
    deletePart,
    getBinById,
    getCompatibleModels,
    getDisplayPartNumber,
    getPartById,
    adjustPart,
  } = useInventory();

  const part = getPartById(partId);

  if (!part) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <PageHero
          eyebrow="Part detail"
          title="That part is not in the current inventory."
          description="The current inventory source did not find a matching part record. Go back to the table or search the lookup screen."
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
                Back to inventory
              </Link>
              <Link
                href="/lookup"
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "bg-amber-400 text-slate-950 hover:bg-amber-300",
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

  const stockStatus = getPartStockStatus(part);
  const locationLabel = getPartLocationLabel(part, bins);
  const compatibleModels = getCompatibleModels(part);
  const activityPartLabel = part.isNpn ? "NPN" : part.partNumber || "Unknown part";
  const bin = getBinById(part.binId ?? "");
  const relatedActivity = activity.filter(
    (entry) => entry.entityId === part.id || entry.title.includes(activityPartLabel),
  );
  const universalOrCompatible = part.universal || compatibleModels.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Part detail"
        title={`${getDisplayPartNumber(part)} · ${part.partName}`}
        description={`${part.manufacturer} ${part.category} part. ${locationLabel}. ${
          universalOrCompatible ? "Compatibility is documented." : "Compatibility still needs attention."
        }`}
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
            {permissions.canPrintLabels && (
              <Link
                href={buildPartPrintHref({ partIds: [part.id] })}
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print tag
              </Link>
            )}
            {permissions.canManageParts && (
              <Link
                href={`/inventory/${part.id}/edit`}
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
                )}
              >
                <Edit3 className="mr-2 h-4 w-4" />
                Edit part
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Quantity on hand"
          value={part.quantityOnHand}
          hint={stockStatus === "healthy" ? "Healthy stock" : `${stockStatus} stock`}
          icon={<Package className="h-5 w-5" />}
          tone={stockStatus === "critical" ? "rose" : stockStatus === "low" ? "amber" : "sky"}
        />
        <StatCard
          label="Reorder point"
          value={part.reorderPoint}
          hint={`Reorder target ${part.reorderTarget}`}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Compatible models"
          value={part.universal ? "Universal" : compatibleModels.length}
          hint={part.universal ? "Applies across the fleet" : "Linked model records"}
          icon={<Boxes className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Last count"
          value={formatRelative(part.lastCountedAt)}
          hint={formatDateTime(part.lastCountedAt)}
          icon={<CalendarClock className="h-5 w-5" />}
          tone="sky"
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-white">Inventory details</CardTitle>
                <CardDescription className="text-slate-400">
                  The current record for this part from the active inventory source.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-white/10 bg-white/5 text-slate-200">
                  {part.manufacturer}
                </Badge>
                <Badge className="border-white/10 bg-white/5 text-slate-200">
                  {part.category}
                </Badge>
                {part.universal && (
                  <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                    Universal
                  </Badge>
                )}
                {requiresAttention(part) && (
                  <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-200">
                    Attention
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Location</p>
                  <p className="mt-2 text-lg font-semibold text-white">{locationLabel}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {bin
                      ? `${bin.aisle}-${bin.row}-${bin.column} · ${bin.description}`
                      : "This part still needs a storage bin."}
                  </p>
                  {bin && (
                    <Link
                      href={`/locations/${bin.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "default" }),
                        "mt-4 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      Open location
                    </Link>
                  )}
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Notes</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{part.notes || "No notes on file."}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Received</p>
                  <p className="mt-2 font-mono text-sm text-slate-100">{formatDateTime(part.receivedAt)}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Updated</p>
                  <p className="mt-2 font-mono text-sm text-slate-100">{formatDateTime(part.updatedAt)}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Counted</p>
                  <p className="mt-2 font-mono text-sm text-slate-100">{formatDateTime(part.lastCountedAt)}</p>
                </div>
              </div>

              <Separator className="bg-white/10" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Quick quantity adjustment</p>
                  <p className="text-xs text-slate-400">
                    Use this when a tech counts the shelf or pulls a replacement.
                  </p>
                </div>
                <div className="flex gap-2">
                  {permissions.canAdjustStock && (
                    <>
                      <Button
                        variant="outline"
                        className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        onClick={() => adjustPart(part.id, -1)}
                      >
                        <Minus className="mr-2 h-4 w-4" />
                        -1
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                        onClick={() => adjustPart(part.id, 1)}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        +1
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Recent activity for this part</CardTitle>
              <CardDescription className="text-slate-400">
                Events that mention {activityPartLabel} or its current record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {relatedActivity.length > 0 ? (
                <ScrollArea className="h-[clamp(18rem,55vh,30rem)] rounded-3xl border border-white/10 bg-slate-950/50">
                  <div className="space-y-3 p-3 pr-4">
                    {relatedActivity.slice(0, 6).map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Badge
                            className={cn(
                              "border",
                              entry.tone === "danger"
                                ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                                : entry.tone === "warning"
                                  ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                                  : entry.tone === "success"
                                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                    : "border-sky-400/20 bg-sky-400/10 text-sky-200",
                            )}
                          >
                            {entry.action}
                          </Badge>
                          <span className="font-mono text-[11px] text-slate-500">
                            {formatRelative(entry.occurredAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-white">{entry.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{entry.detail}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                  No activity has been logged for this part yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Compatibility</CardTitle>
              <CardDescription className="text-slate-400">
                Model records linked to this part.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {part.universal ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                  This part is marked universal and should apply across the fleet.
                </div>
              ) : compatibleModels.length > 0 ? (
                <ScrollArea className="h-[clamp(14rem,42vh,24rem)] rounded-3xl border border-white/10 bg-slate-950/50">
                  <div className="space-y-3 p-3 pr-4">
                    {compatibleModels.map((model) => (
                      <div
                        key={model.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                      >
                        <p className="text-sm font-semibold text-white">
                          {model.manufacturer} {model.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {model.series} · {model.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                  No compatible models are assigned yet. This record will stay flagged until
                  it is linked or marked universal.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Fast actions</CardTitle>
              <CardDescription className="text-slate-400">
                Common workflows for the parts counter.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {permissions.canManageParts && (
                <Link
                  href={`/inventory/${part.id}/edit`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "h-11 justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit part
                </Link>
              )}
              <Link
                href="/lookup"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "h-11 justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <ScanSearch className="mr-2 h-4 w-4" />
                Lookup nearby parts
              </Link>
              {permissions.canManageParts && (
                <Button
                  variant="outline"
                  className="h-11 justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${getDisplayPartNumber(part)}? This removes the part from the current inventory source.`,
                      )
                    ) {
                      deletePart(part.id);
                    }
                  }}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Delete part
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
