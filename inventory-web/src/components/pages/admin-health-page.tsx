"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Clock3,
  Database,
  Gauge,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import type { AdminHealthReport, HealthSeverity } from "@/lib/admin-health";
import { PageHero } from "@/components/page-hero";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelative, getActivityAuditLabel } from "@/lib/inventory-utils";
import type { AuditAction } from "@/lib/inventory-types";

function severityTone(severity: HealthSeverity) {
  switch (severity) {
    case "critical":
      return "rose" as const;
    case "warning":
      return "amber" as const;
    case "healthy":
      return "emerald" as const;
    case "info":
    default:
      return "sky" as const;
  }
}

function severityLabel(severity: HealthSeverity) {
  switch (severity) {
    case "critical":
      return "Critical";
    case "warning":
      return "Warning";
    case "healthy":
      return "Healthy";
    case "info":
    default:
      return "Info";
  }
}

function alertClassName(severity: HealthSeverity) {
  switch (severity) {
    case "critical":
      return "border-rose-400/20 bg-rose-400/10 text-rose-100";
    case "warning":
      return "border-amber-400/20 bg-amber-400/10 text-amber-100";
    case "healthy":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
    case "info":
    default:
      return "border-sky-400/20 bg-sky-400/10 text-sky-100";
  }
}

function logClassName(severity: HealthSeverity) {
  switch (severity) {
    case "critical":
      return "border-rose-400/20 bg-rose-400/10 text-rose-100";
    case "warning":
      return "border-amber-400/20 bg-amber-400/10 text-amber-100";
    case "healthy":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
    case "info":
    default:
      return "border-sky-400/20 bg-sky-400/10 text-sky-100";
  }
}

type AdminHealthPageProps = {
  initialReport: AdminHealthReport;
};

export function AdminHealthPage({ initialReport }: AdminHealthPageProps) {
  const [report, setReport] = useState(initialReport);
  const [refreshing, setRefreshing] = useState(false);

  const statCards = useMemo(
    () => [
      {
        label: "Site",
        value: severityLabel(report.site.status),
        hint: report.site.summary,
        icon: <Gauge className="h-5 w-5" />,
        tone: severityTone(report.site.status),
      },
      {
        label: "Database",
        value: severityLabel(report.database.status),
        hint: report.database.summary,
        icon: <Database className="h-5 w-5" />,
        tone: severityTone(report.database.status),
      },
      {
        label: "Alerts",
        value: report.alerts.length,
        hint: "Warnings and alerts that need review",
        icon: <TriangleAlert className="h-5 w-5" />,
        tone: report.alerts.some((alert) => alert.severity === "critical") ? ("rose" as const) : ("amber" as const),
      },
      {
        label: "Logs",
        value: report.logs.length,
        hint: "Recent inventory and system activity",
        icon: <Clock3 className="h-5 w-5" />,
        tone: "sky" as const,
      },
    ],
    [report.alerts, report.database.status, report.database.summary, report.logs.length, report.site.status, report.site.summary],
  );

  const refreshReport = async () => {
    setRefreshing(true);

    try {
      const response = await fetch("/api/admin/health", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: AdminHealthReport; message?: string }
        | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.message ?? "Failed to refresh health status.");
      }

      setReport(payload.data);
      toast.success("Health dashboard refreshed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to refresh health status.";
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <PageHero
        eyebrow="Admin health"
        title="Site, database, warnings, and logs in one place."
        description="Use this dashboard to confirm the live workspace is healthy, spot alerts early, and review recent log activity."
        actions={
          <>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={refreshReport}
              disabled={refreshing}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
            <Link
              href="/admin/users"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "bg-amber-400 text-slate-950 hover:bg-amber-300",
              )}
            >
              Users
            </Link>
          </>
        }
      />

      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            hint={card.hint}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Site status</CardTitle>
            <CardDescription className="text-slate-400">
              Deployment, authentication, and QR-ready configuration checks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {report.site.metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{metric.value}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{metric.detail}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
              {report.site.summary}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Database status</CardTitle>
            <CardDescription className="text-slate-400">
              Live table counts, archival state, and the freshest update time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {report.database.metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{metric.value}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{metric.detail}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
              {report.database.summary}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Warnings & alerts</CardTitle>
            <CardDescription className="text-slate-400">
              Issues that deserve attention from an admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.alerts.length > 0 ? (
              <ScrollArea className="h-[clamp(16rem,55vh,28rem)] rounded-3xl border border-white/10 bg-slate-950/50">
                <div className="space-y-3 p-3 pr-4">
                  {report.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">{alert.title}</p>
                          <p className="text-xs leading-5 text-slate-400">{alert.detail}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={alertClassName(alert.severity)}>{severityLabel(alert.severity)}</Badge>
                          <Badge className="border-white/10 bg-white/5 text-slate-200">
                            {alert.scope}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                No active alerts at the moment.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Recent logs</CardTitle>
            <CardDescription className="text-slate-400">
              The latest inventory and import activity from the live workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.logs.length > 0 ? (
              <ScrollArea className="h-[clamp(18rem,60vh,32rem)] rounded-3xl border border-white/10 bg-slate-950/50">
                <div className="space-y-3 p-3 pr-4">
                  {report.logs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={logClassName(log.severity)}>{severityLabel(log.severity)}</Badge>
                          {log.auditType && (
                            <Badge className="border-white/10 bg-white/5 text-slate-200">
                              {getActivityAuditLabel({
                                action: "updated",
                                auditType: log.auditType as AuditAction,
                                tone: "info",
                              })}
                            </Badge>
                          )}
                          {log.actorLabel && (
                            <Badge className="border-white/10 bg-white/5 text-slate-200">
                              {log.actorLabel}
                            </Badge>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">
                          {formatRelative(log.occurredAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">{log.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{log.detail}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        {log.entityLabel && <span>{log.entityLabel}</span>}
                        {log.delta !== undefined && <span>Delta {log.delta}</span>}
                        {log.previousQuantity !== undefined && <span>Before {log.previousQuantity}</span>}
                        {log.nextQuantity !== undefined && <span>After {log.nextQuantity}</span>}
                        {log.labelMode && <span>{log.labelMode}</span>}
                        {log.labelCopies !== undefined && <span>x{log.labelCopies}</span>}
                      </div>
                      <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        {formatDateTime(log.occurredAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                No log entries yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Quick actions</CardTitle>
          <CardDescription className="text-slate-400">
            Jump straight to the admin workflows that usually need a second look.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: "/import-export", label: "Reports & Exports" },
            { href: "/activity", label: "Activity log" },
            { href: "/settings", label: "Settings" },
            { href: "/inventory", label: "Inventory" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "h-11 justify-start border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              <ArrowUpRight className="mr-2 h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
