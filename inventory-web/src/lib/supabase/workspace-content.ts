import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ComingSoonItem,
  Faq,
  ForumPost,
  ForumThread,
  FeatureRequestVote,
  GreenMachine,
  GreenMachineEvent,
  Notification,
  Sop,
  UpdateLog,
  WorkspaceContentState,
} from "@/lib/workspace-content-types";

export type WorkspaceRecordType =
  | "faq"
  | "forum_thread"
  | "forum_post"
  | "feature_request_vote"
  | "update_log"
  | "coming_soon"
  | "sop"
  | "notification"
  | "green_machine"
  | "green_machine_event";

export type WorkspaceContentPayload =
  | Faq
  | ForumThread
  | ForumPost
  | FeatureRequestVote
  | UpdateLog
  | ComingSoonItem
  | Sop
  | Notification
  | GreenMachine
  | GreenMachineEvent;

type WorkspaceRecordRow = {
  id: string;
  record_type: WorkspaceRecordType;
  owner_id: string | null;
  payload: WorkspaceContentPayload;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  purge_after: string | null;
  created_at: string;
  updated_at: string;
};

const RETENTION_DAYS = 30;

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function recordTypeFor(payload: WorkspaceContentPayload): WorkspaceRecordType {
  if ("question" in payload) return "faq";
  if ("featureRequestId" in payload) return "feature_request_vote";
  if ("threadId" in payload) return "forum_post";
  if ("type" in payload && (payload.type === "support" || payload.type === "general" || payload.type === "feature_request")) {
    return "forum_thread";
  }
  if ("publishedAt" in payload) return "update_log";
  if ("targetDate" in payload) return "coming_soon";
  if ("roleVisibility" in payload) return "sop";
  if ("isRead" in payload) return "notification";
  if ("eventType" in payload) return "green_machine_event";
  return "green_machine";
}

function ownerIdFor(payload: WorkspaceContentPayload, currentUserId: string) {
  if ("userId" in payload && isUuid(payload.userId)) return payload.userId;
  if ("userId" in payload && payload.userId === currentUserId) return currentUserId;
  if ("roleTarget" in payload && payload.userId && isUuid(payload.userId)) return payload.userId;
  return null;
}

function itemCreatedAt(payload: WorkspaceContentPayload, fallback: string) {
  if ("createdAt" in payload && payload.createdAt) return payload.createdAt;
  if ("publishedAt" in payload && payload.publishedAt) return payload.publishedAt;
  return fallback;
}

function itemUpdatedAt(payload: WorkspaceContentPayload, fallback: string) {
  if ("updatedAt" in payload && payload.updatedAt) return payload.updatedAt;
  return fallback;
}

function retentionDate(value: string | null | undefined, fallback: string | null) {
  if (!value && !fallback) return null;
  const timestamp = new Date(value ?? fallback ?? "").getTime();
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function payloadWithLifecycle(
  row: WorkspaceRecordRow,
): WorkspaceContentPayload {
  return {
    ...row.payload,
    id: row.id,
    ...(row.record_type === "green_machine" && (row.archived_at || row.deleted_at || row.purge_after)
      ? { status: "archived", archivedStatus: (row.payload as GreenMachine).archivedStatus ?? ((row.payload as GreenMachine).status === "archived" ? "active" : (row.payload as GreenMachine).status) }
      : {}),
    ...(row.record_type === "forum_thread" && (row.archived_at || row.deleted_at || row.purge_after)
      ? { status: row.deleted_at ? "deleted" : "archived" }
      : {}),
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    purgeAfter: row.purge_after,
  } as WorkspaceContentPayload;
}

export async function fetchWorkspaceContentState(
  supabase: SupabaseClient,
  currentUserId?: string,
): Promise<WorkspaceContentState> {
  const { data, error } = await supabase
    .from("workspace_records")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as WorkspaceRecordRow[];
  const receiptByNotificationId = new Map<string, { read_at: string | null; archived_at: string | null; deleted_at: string | null }>();
  if (isUuid(currentUserId)) {
    const { data: receipts, error: receiptError } = await supabase
      .from("workspace_notification_receipts")
      .select("notification_id, read_at, archived_at, deleted_at")
      .eq("user_id", currentUserId);
    if (receiptError) throw receiptError;
    for (const receipt of receipts ?? []) {
      receiptByNotificationId.set(receipt.notification_id as string, receipt);
    }
  }
  const state: WorkspaceContentState = {
    faqs: [],
    forumThreads: [],
    forumPosts: [],
    featureRequestVotes: [],
    updateLogs: [],
    comingSoonItems: [],
    sops: [],
    notifications: [],
    greenMachines: [],
    greenMachineEvents: [],
  };

  for (const row of rows) {
    // These entities have no retained-history editor. Hidden rows must not return
    // as editable/published content merely because Admin RLS can still read them.
    if ((row.archived_at || row.deleted_at || row.purge_after) &&
      ["faq", "sop", "update_log", "coming_soon", "forum_post", "feature_request_vote"].includes(row.record_type)) continue;
    const payload = payloadWithLifecycle(row);
    switch (row.record_type) {
      case "faq":
        state.faqs.push(payload as Faq);
        break;
      case "forum_thread":
        state.forumThreads.push(payload as ForumThread);
        break;
      case "forum_post":
        state.forumPosts.push(payload as ForumPost);
        break;
      case "feature_request_vote":
        state.featureRequestVotes.push(payload as FeatureRequestVote);
        break;
      case "update_log":
        state.updateLogs.push(payload as UpdateLog);
        break;
      case "coming_soon":
        state.comingSoonItems.push(payload as ComingSoonItem);
        break;
      case "sop":
        state.sops.push(payload as Sop);
        break;
      case "notification":
        {
          const notification = payload as Notification;
          const receipt = receiptByNotificationId.get(row.id);
          state.notifications.push({
            ...notification,
            isRead: Boolean(receipt?.read_at) || notification.isRead,
            archivedAt: receipt?.archived_at ?? notification.archivedAt ?? null,
            deletedAt: receipt?.deleted_at ?? notification.deletedAt ?? null,
          });
        }
        break;
      case "green_machine":
        if (!row.deleted_at) state.greenMachines.push(payload as GreenMachine);
        break;
      case "green_machine_event":
        state.greenMachineEvents.push(payload as GreenMachineEvent);
        break;
    }
  }

  return state;
}

export async function markWorkspaceNotificationRead(
  supabase: SupabaseClient,
  notificationId: string,
  currentUserId: string,
) {
  const { error, count } = await supabase.from("workspace_notification_receipts").upsert(
    {
      notification_id: notificationId,
      user_id: currentUserId,
      read_at: new Date().toISOString(),
    },
    { onConflict: "notification_id,user_id", count: "exact" },
  );
  if (error) throw error;
  if (count !== 1) throw new Error("Notification was not saved. Reload and try again.");
}

export async function setWorkspaceNotificationLifecycle(
  supabase: SupabaseClient,
  notificationId: string,
  currentUserId: string,
  mode: "archived" | "deleted" | "restored",
) {
  const now = new Date().toISOString();
  const retention = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await supabase.from("workspace_notification_receipts").upsert(
    {
      notification_id: notificationId,
      user_id: currentUserId,
      archived_at: mode === "archived" ? now : null,
      deleted_at: mode === "deleted" ? now : null,
      purge_after: mode === "restored" ? null : retention,
    },
    { onConflict: "notification_id,user_id", count: "exact" },
  );
  if (error) throw error;
  if (count !== 1) throw new Error("Notification was not saved. Reload and try again.");
}

export async function upsertWorkspaceRecord(
  supabase: SupabaseClient,
  payload: WorkspaceContentPayload,
  currentUserId: string,
  mode: "create" | "update" | "restore" = "create",
) {
  const now = new Date().toISOString();
  const recordType = recordTypeFor(payload);
  const archivedAt = "archivedAt" in payload ? payload.archivedAt ?? null : null;
  const deletedAt = "deletedAt" in payload ? payload.deletedAt ?? null : null;
  const lifecycleTimestamp = archivedAt ?? deletedAt;
  const createdBy = "createdBy" in payload && isUuid(payload.createdBy) ? payload.createdBy : currentUserId;
  const row = {
    id: payload.id,
    record_type: recordType,
    owner_id: ownerIdFor(payload, currentUserId),
    payload,
    created_by: isUuid(createdBy) ? createdBy : null,
    updated_by: isUuid(currentUserId) ? currentUserId : null,
    archived_at: archivedAt,
    archived_by: archivedAt && isUuid(currentUserId) ? currentUserId : null,
    deleted_at: deletedAt,
    deleted_by: deletedAt && isUuid(currentUserId) ? currentUserId : null,
    purge_after:
      "purgeAfter" in payload && payload.purgeAfter
        ? payload.purgeAfter
        : retentionDate(lifecycleTimestamp, null),
    created_at: itemCreatedAt(payload, now),
    updated_at: itemUpdatedAt(payload, now),
  };

  // Existing records must never be recreated by a stale edit or restore.
  let request = mode === "create"
    ? supabase.from("workspace_records").insert(row, { count: "exact" })
    : supabase.from("workspace_records").update(row, { count: "exact" }).eq("id", payload.id);
  if (mode === "update") request = request.is("deleted_at", null).is("archived_at", null).is("purge_after", null);
  const { error, count } = await request;
  if (error) throw error;
  if (count !== 1) throw new Error("Record was not saved. It may have been removed or your permissions changed. Reload and try again.");
}

export async function archiveWorkspaceRecord(
  supabase: SupabaseClient,
  recordId: string,
  currentUserId: string,
  mode: "archived" | "deleted",
) {
  const now = new Date().toISOString();
  const { error, count } = await supabase
    .from("workspace_records")
    .update({
      archived_at: mode === "archived" ? now : null,
      archived_by: mode === "archived" && isUuid(currentUserId) ? currentUserId : null,
      deleted_at: mode === "deleted" ? now : null,
      deleted_by: mode === "deleted" && isUuid(currentUserId) ? currentUserId : null,
      purge_after: new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      updated_by: isUuid(currentUserId) ? currentUserId : null,
    }, { count: "exact" })
    .eq("id", recordId);

  if (error) throw error;
  if (count !== 1) throw new Error("Record was not removed. It may no longer exist or you may not have permission.");
}

export async function restoreWorkspaceRecord(
  supabase: SupabaseClient,
  recordId: string,
  currentUserId: string,
) {
  const { error, count } = await supabase
    .from("workspace_records")
    .update({
      archived_at: null,
      archived_by: null,
      deleted_at: null,
      deleted_by: null,
      purge_after: null,
      updated_by: isUuid(currentUserId) ? currentUserId : null,
    }, { count: "exact" })
    .eq("id", recordId);

  if (error) throw error;
  if (count !== 1) throw new Error("Record was not restored. Reload and try again.");
}
