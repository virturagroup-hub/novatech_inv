"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Clock3, History, WandSparkles } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useInventory } from "@/components/inventory-provider";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelative, getActivityColor } from "@/lib/inventory-utils";

type ActivityFilter = "all" | "part" | "bin" | "model" | "inventory" | "system";

export function ActivityPage() {
  const { permissions } = useAuth();
  const { activity, summary } = useInventory();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const filteredActivity = useMemo(() => {
    const search = query.trim().toLowerCase();
    return activity.filter((entry) => {
      if (filter !== "all" && entry.entityType !== filter) return false;
      if (!search) return true;
      return `${entry.action} ${entry.title} ${entry.detail} ${entry.entityType}`.toLowerCase().includes(search);
    });
  }, [activity, filter, query]);

  const actionCounts = useMemo(() => {
    return {
      added: activity.filter((entry) => entry.action === "added").length,
      updated: activity.filter((entry) => entry.action === "updated").length,
      adjusted: activity.filter((entry) => entry.action === "adjusted").length,
      printed: activity.filter((entry) => entry.action === "printed").length,
    };
  }, [activity]);

  if (!permissions.canViewActivity) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <PageHero
          eyebrow="Activity log"
          title="Activity is restricted for your role."
          description="Viewer accounts can still use lookup and inventory search, but the audit trail is limited to elevated users and technicians."
          actions={
            <Link
              href="/inventory"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-amber-400 text-slate-950 hover:bg-amber-300",
              )}
            >
              Inventory
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Activity log"
        title="Audit trail for the current inventory source."
        description="Review recent imports, stock changes, label actions, and system updates from the active workspace."
        actions={
          <>
            <Link
              href="/import-export"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              Import / export
            </Link>
            <Link
              href="/inventory"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-amber-400 text-slate-950 hover:bg-amber-300",
              )}
            >
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Inventory
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Entries"
          value={activity.length}
          hint="Total event count"
          icon={<History className="h-5 w-5" />}
        />
        <StatCard
          label="Updated"
          value={actionCounts.updated}
          hint="Saved record changes"
          icon={<WandSparkles className="h-5 w-5" />}
          tone="sky"
        />
        <StatCard
          label="Adjusted"
          value={actionCounts.adjusted}
          hint="Quantity moves"
          icon={<Clock3 className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Printed"
          value={actionCounts.printed}
          hint="Tag and label actions"
          icon={<ArrowUpRight className="h-5 w-5" />}
          tone="emerald"
        />
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1fr_220px]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Search activity</p>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search action, title, detail, or entity type"
              className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Filter</p>
            <Select value={filter} onValueChange={(value) => setFilter(value as ActivityFilter)}>
              <SelectTrigger className="border-white/10 bg-slate-950/70 text-white">
                <SelectValue placeholder="All activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activity</SelectItem>
                <SelectItem value="part">Parts</SelectItem>
                <SelectItem value="bin">Bins</SelectItem>
                <SelectItem value="model">Models</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Timeline</CardTitle>
          <CardDescription className="text-slate-400">
            Review recent actions in chronological order.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredActivity.length > 0 ? (
            <ScrollArea className="h-[clamp(24rem,65vh,42rem)] rounded-3xl border border-white/10 bg-slate-950/50">
              <div className="space-y-3 p-3 pr-4">
                {filteredActivity.map((entry) => {
                  const activityTone = getActivityColor(entry.action);

                  return (
                    <div key={entry.id} className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={cn(
                              "border",
                              activityTone === "danger"
                                ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                                : activityTone === "warning"
                                  ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                                  : activityTone === "success"
                                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                    : "border-sky-400/20 bg-sky-400/10 text-sky-200",
                            )}
                          >
                            {entry.action}
                          </Badge>
                          <Badge className="border-white/10 bg-white/5 text-slate-200">
                            {entry.entityType}
                          </Badge>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">
                          {formatRelative(entry.occurredAt)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-white">{entry.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{entry.detail}</p>
                      <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        {formatDateTime(entry.occurredAt)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
              No activity matched the current filters.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Audit trail notes</CardTitle>
          <CardDescription className="text-slate-400">
            The activity feed is sourced from the current workspace state and live transaction history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
            {summary.totalUnits} total units are being tracked in the active inventory source.
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
            Imports, adjustments, and label events stay visible here for quick review by elevated users.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
