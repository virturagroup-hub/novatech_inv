import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnvPresence } from "@/lib/supabase/env";
import type { InventoryTransactionRow, LocationRow, ModelRow, PartRow, ProfileRow } from "@/lib/supabase/types";

export type HealthSeverity = "healthy" | "warning" | "critical" | "info";

export interface AdminHealthMetric {
  label: string;
  value: string;
  detail: string;
}

export interface AdminHealthAlert {
  id: string;
  scope: "site" | "database" | "workspace";
  severity: HealthSeverity;
  title: string;
  detail: string;
}

export interface AdminHealthLog {
  id: string;
  severity: HealthSeverity;
  title: string;
  detail: string;
  occurredAt: string;
  auditType?: string | null;
  actorLabel?: string | null;
  delta?: number | null;
  entityLabel?: string | null;
  labelMode?: string | null;
  labelCopies?: number | null;
  nextQuantity?: number | null;
  previousQuantity?: number | null;
}

export interface AdminHealthSection {
  status: HealthSeverity;
  summary: string;
  metrics: AdminHealthMetric[];
}

export interface AdminHealthReport {
  generatedAt: string;
  site: AdminHealthSection;
  database: AdminHealthSection;
  alerts: AdminHealthAlert[];
  logs: AdminHealthLog[];
}

function maxTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function transactionSeverity(transaction: InventoryTransactionRow): HealthSeverity {
  if (transaction.transaction_type === "import") return "info";
  if (transaction.transaction_type === "reset") return "warning";
  if (transaction.transaction_type === "transfer") return "info";
  return transaction.delta < 0 ? "warning" : "healthy";
}

function transactionTitle(transaction: InventoryTransactionRow, partLabel: string) {
  switch (transaction.transaction_type) {
    case "import":
      return `Imported ${partLabel}`;
    case "reset":
      return `Reset ${partLabel}`;
    case "transfer":
      return `Moved ${partLabel}`;
    case "adjustment":
    default:
      return `Adjusted ${partLabel}`;
  }
}

function transactionDetail(transaction: InventoryTransactionRow, partLabel: string) {
  const deltaPrefix = transaction.delta >= 0 ? "+" : "";
  const base = `${deltaPrefix}${transaction.delta} units`;
  const note = transaction.note?.trim();

  if (note) {
    return `${base} · ${note}`;
  }

  return `${base} · ${partLabel}`;
}

export async function buildAdminHealthReport(supabase: SupabaseClient): Promise<AdminHealthReport> {
  const env = getSupabaseEnvPresence();

  const [partsResult, locationsResult, modelsResult, profilesResult, transactionsResult] =
    await Promise.all([
      supabase.from("parts").select("id, updated_at"),
      supabase.from("locations").select("id, status, updated_at"),
      supabase.from("models").select("id, status, updated_at"),
      supabase.from("profiles").select("id, active, updated_at"),
      supabase
        .from("inventory_transactions")
        .select("id, part_id, delta, transaction_type, note, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const queryErrors = [
    partsResult.error,
    locationsResult.error,
    modelsResult.error,
    profilesResult.error,
    transactionsResult.error,
  ].flatMap((error) => (error ? [error] : []));

  const parts = (partsResult.data ?? []) as PartRow[];
  const locations = (locationsResult.data ?? []) as LocationRow[];
  const models = (modelsResult.data ?? []) as ModelRow[];
  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const transactions = (transactionsResult.data ?? []) as InventoryTransactionRow[];

  const recentPartIds = [...new Set(transactions.map((transaction) => transaction.part_id))];
  const recentPartsResult =
    recentPartIds.length > 0
      ? await supabase.from("parts").select("id, part_number, part_name, is_npn").in("id", recentPartIds)
      : { data: [], error: null };

  const recentParts = (recentPartsResult.data ?? []) as Array<{
    id: string;
    part_number: string | null;
    is_npn: boolean;
    part_name: string;
  }>;

  const recentPartLookup = new Map(
    recentParts.map((part) => [
      part.id,
      `${part.is_npn ? "NPN" : part.part_number ?? "Unknown part"} · ${part.part_name}`,
    ]),
  );

  const inactiveLocations = locations.filter((location) => location.status === "inactive").length;
  const inactiveModels = models.filter((model) => model.status === "inactive").length;
  const inactiveUsers = profiles.filter((profile) => !profile.active).length;

  const siteAlerts: AdminHealthAlert[] = [];
  const databaseAlerts: AdminHealthAlert[] = [];
  const workspaceAlerts: AdminHealthAlert[] = [];

  if (!env.supabaseUrlConfigured || !env.middlewareReady) {
    siteAlerts.push({
      id: "supabase-env",
      scope: "site",
      severity: "critical",
      title: "Supabase environment needs attention",
      detail:
        env.reason ?? "The public Supabase URL or publishable key is missing from this deployment.",
    });
  }

  if (!process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    siteAlerts.push({
      id: "app-url",
      scope: "site",
      severity: "warning",
      title: "App URL is not configured",
      detail: "Set NEXT_PUBLIC_APP_URL so QR labels always resolve to the right site origin.",
    });
  }

  if (queryErrors.length > 0) {
    databaseAlerts.push({
      id: "query-error",
      scope: "database",
      severity: "critical",
      title: "One or more database checks failed",
      detail:
        queryErrors
          .map((error) => (error instanceof Error ? error.message : "Unknown query error"))
          .join(" · "),
    });
  }

  if (parts.length === 0) {
    databaseAlerts.push({
      id: "no-parts",
      scope: "database",
      severity: "warning",
      title: "No parts records yet",
      detail: "Import a CSV or add the first part so the dashboard has live inventory to show.",
    });
  }

  if (locations.length === 0) {
    databaseAlerts.push({
      id: "no-locations",
      scope: "database",
      severity: "warning",
      title: "No locations configured",
      detail: "Add locations so parts can be assigned to a real bin and scan labels stay useful.",
    });
  }

  if (models.length === 0) {
    databaseAlerts.push({
      id: "no-models",
      scope: "database",
      severity: "warning",
      title: "No compatibility models configured",
      detail: "Add printer and copier models so part compatibility lookups stay useful.",
    });
  }

  if (transactions.length === 0) {
    workspaceAlerts.push({
      id: "no-logs",
      scope: "workspace",
      severity: "info",
      title: "No log entries yet",
      detail: "Inventory changes, imports, and stock adjustments will appear here once the team starts working.",
    });
  }

  if (inactiveLocations > 0) {
    workspaceAlerts.push({
      id: "inactive-locations",
      scope: "workspace",
      severity: "info",
      title: `${inactiveLocations} archived location${inactiveLocations === 1 ? "" : "s"}`,
      detail: "Inactive locations stay out of normal assignment flows unless they are restored.",
    });
  }

  if (inactiveModels > 0) {
    workspaceAlerts.push({
      id: "inactive-models",
      scope: "workspace",
      severity: "info",
      title: `${inactiveModels} archived model${inactiveModels === 1 ? "" : "s"}`,
      detail: "Inactive models remain available for historical compatibility lookups.",
    });
  }

  if (inactiveUsers > 0) {
    workspaceAlerts.push({
      id: "inactive-users",
      scope: "workspace",
      severity: "info",
      title: `${inactiveUsers} inactive user${inactiveUsers === 1 ? "" : "s"}`,
      detail: "Inactive accounts are blocked from signing in until an admin restores them.",
    });
  }

  const alerts = [...siteAlerts, ...databaseAlerts, ...workspaceAlerts];

  const siteStatus: HealthSeverity =
    !env.supabaseUrlConfigured || !env.middlewareReady
      ? "critical"
      : !process.env.NEXT_PUBLIC_APP_URL?.trim()
        ? "warning"
        : "healthy";

  const databaseStatus: HealthSeverity =
    queryErrors.length > 0
      ? "critical"
      : parts.length === 0 || locations.length === 0 || models.length === 0
        ? "warning"
        : "healthy";

  const siteSummary =
    siteStatus === "critical"
      ? "The live workspace environment needs attention before everything can load cleanly."
      : siteStatus === "warning"
        ? "The site is running, but at least one configuration detail should be filled in."
        : "The site is connected and the public Supabase settings look ready.";

  const databaseSummary =
    databaseStatus === "critical"
      ? "A live database check failed and the health dashboard needs attention."
      : databaseStatus === "warning"
        ? "The database is reachable, but there are setup gaps or empty tables to review."
        : "The inventory tables are readable and the live workspace looks healthy.";

  const latestUpdatedAt = maxTimestamp([
    ...parts.map((part) => part.updated_at),
    ...locations.map((location) => location.updated_at),
    ...models.map((model) => model.updated_at),
    ...profiles.map((profile) => profile.updated_at),
    ...transactions.map((transaction) => transaction.created_at),
  ]);

  const siteMetrics: AdminHealthMetric[] = [
    {
      label: "Deployment",
      value: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local",
      detail: "Current runtime environment.",
    },
    {
      label: "Supabase URL",
      value: env.supabaseUrlConfigured ? "Configured" : "Missing",
      detail: "Public project URL for auth and data.",
    },
    {
      label: "Public key",
      value: env.supabasePublishableKeyConfigured || env.supabaseAnonKeyConfigured ? "Configured" : "Missing",
      detail: "Browser-safe key used by auth and live data.",
    },
    {
      label: "App URL",
      value: process.env.NEXT_PUBLIC_APP_URL?.trim() ? "Configured" : "Missing",
      detail: "Absolute origin used by QR scan labels.",
    },
  ];

  const databaseMetrics: AdminHealthMetric[] = [
    {
      label: "Parts",
      value: parts.length.toString(),
      detail: "Inventory records in the live workspace.",
    },
    {
      label: "Locations",
      value: locations.length.toString(),
      detail: `${inactiveLocations} archived location${inactiveLocations === 1 ? "" : "s"} included.`,
    },
    {
      label: "Models",
      value: models.length.toString(),
      detail: `${inactiveModels} archived model${inactiveModels === 1 ? "" : "s"} included.`,
    },
    {
      label: "Profiles",
      value: profiles.length.toString(),
      detail: `${inactiveUsers} inactive user${inactiveUsers === 1 ? "" : "s"} included.`,
    },
    {
      label: "Logs",
      value: transactions.length.toString(),
      detail: "Recent inventory changes and imports.",
    },
    {
      label: "Last update",
      value: latestUpdatedAt ? new Date(latestUpdatedAt).toLocaleString() : "No updates yet",
      detail: "Most recent timestamp from live tables or logs.",
    },
  ];

  const logs: AdminHealthLog[] = transactions.map((transaction) => {
    const partLabel = recentPartLookup.get(transaction.part_id) ?? transaction.part_id;

    return {
      id: transaction.id,
      severity: transactionSeverity(transaction),
      title: transactionTitle(transaction, partLabel),
      detail: transactionDetail(transaction, partLabel),
      occurredAt: transaction.created_at,
      auditType: transaction.audit_type ?? null,
      actorLabel: transaction.actor_label ?? null,
      delta: transaction.delta,
      entityLabel: partLabel,
      labelMode: transaction.label_mode ?? null,
      labelCopies: transaction.label_copies ?? null,
      nextQuantity: transaction.next_quantity ?? null,
      previousQuantity: transaction.previous_quantity ?? null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    site: {
      status: siteStatus,
      summary: siteSummary,
      metrics: siteMetrics,
    },
    database: {
      status: databaseStatus,
      summary: databaseSummary,
      metrics: databaseMetrics,
    },
    alerts,
    logs,
  };
}
