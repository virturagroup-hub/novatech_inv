"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  archiveWorkspaceRecord,
  fetchWorkspaceContentState,
  markWorkspaceNotificationRead,
  setWorkspaceNotificationLifecycle,
  upsertWorkspaceRecord,
  type WorkspaceContentPayload,
} from "@/lib/supabase/workspace-content";
import {
  createDefaultWorkspaceContentState,
  createSeedWorkspaceContentState,
  workspaceContentStorageKey,
} from "@/lib/workspace-content-seed";
import {
  getGreenMachineRestoreStatus,
  purgeExpiredGreenMachines,
} from "@/lib/green-machine-retention";
import { purgeExpiredForumThreads } from "@/lib/workspace-thread-retention";
import type {
  ComingSoonItem,
  ComingSoonItemDraft,
  Faq,
  FaqDraft,
  ForumPost,
  ForumPostDraft,
  ForumThread,
  ForumThreadDraft,
  GreenMachine,
  GreenMachineDraft,
  GreenMachineEvent,
  GreenMachineEventDraft,
  Notification,
  NotificationTarget,
  Sop,
  SopDraft,
  UpdateLog,
  UpdateLogDraft,
  WorkspaceContentState,
} from "@/lib/workspace-content-types";

type WorkspaceContentContextValue = WorkspaceContentState & {
  refreshWorkspace: () => Promise<void>;
  hydrated: boolean;
  visibleNotifications: Notification[];
  unreadNotificationCount: number;
  publishedFaqs: Faq[];
  visibleSops: Sop[];
  publishedUpdateLogs: UpdateLog[];
  publishedComingSoonItems: ComingSoonItem[];
  supportThreads: ForumThread[];
  featureRequests: ForumThread[];
  greenMachineEventsFor: (machineId: string) => GreenMachineEvent[];
  getThreadById: (threadId: string) => ForumThread | null;
  getGreenMachineById: (machineId: string) => GreenMachine | null;
  getThreadPosts: (threadId: string) => ForumPost[];
  getFeatureRequestScore: (threadId: string) => number;
  saveFaq: (draft: FaqDraft, mode?: "create" | "update") => Promise<boolean | undefined>;
  deleteFaq: (faqId: string) => Promise<boolean | undefined>;
  saveUpdateLog: (draft: UpdateLogDraft, mode?: "create" | "update") => Promise<boolean | undefined>;
  deleteUpdateLog: (updateLogId: string) => Promise<boolean | undefined>;
  saveComingSoonItem: (draft: ComingSoonItemDraft, mode?: "create" | "update") => Promise<boolean | undefined>;
  deleteComingSoonItem: (itemId: string) => Promise<boolean | undefined>;
  saveSop: (draft: SopDraft) => Promise<boolean | undefined>;
  deleteSop: (sopId: string) => Promise<boolean | undefined>;
  saveForumThread: (draft: ForumThreadDraft) => Promise<string | null>;
  addForumPost: (threadId: string, draft: ForumPostDraft) => Promise<boolean | undefined>;
  setForumThreadStatus: (threadId: string, status: ForumThread["status"]) => Promise<boolean | undefined>;
  setForumThreadPinned: (threadId: string, pinned: boolean) => Promise<boolean | undefined>;
  setForumThreadLocked: (threadId: string, locked: boolean) => Promise<boolean | undefined>;
  voteFeatureRequest: (threadId: string, vote: 1 | -1) => Promise<boolean | undefined>;
  markNotificationRead: (notificationId: string) => Promise<boolean | undefined>;
  markAllNotificationsRead: () => Promise<boolean | undefined>;
  archiveNotification: (notificationId: string) => Promise<boolean | undefined>;
  deleteNotification: (notificationId: string) => Promise<boolean | undefined>;
  restoreNotification: (notificationId: string) => Promise<boolean | undefined>;
  saveGreenMachine: (draft: GreenMachineDraft) => Promise<string | null>;
  archiveGreenMachine: (machineId: string) => Promise<boolean | undefined>;
  deleteGreenMachine: (machineId: string) => Promise<boolean | undefined>;
  restoreGreenMachine: (machineId: string) => Promise<boolean>;
  addGreenMachineEvent: (machineId: string, draft: GreenMachineEventDraft) => Promise<void>;
};

const WorkspaceContentContext = createContext<WorkspaceContentContextValue | null>(null);

function timestamp() {
  return new Date().toISOString();
}

function normalizeText(value: string) {
  return value.trim();
}

function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
  );
}

function isDemoDataExplicitlyEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "true";
}

function isWorkspaceContentDemoModeEnabled() {
  return process.env.NODE_ENV !== "production" && (!isSupabaseConfigured() || isDemoDataExplicitlyEnabled());
}

function safeParseWorkspaceContentState(raw: string | null): Partial<WorkspaceContentState> | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceContentState>;

    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function hydrateWorkspaceContentState(
  stored: Partial<WorkspaceContentState> | null,
  fallback: WorkspaceContentState,
): WorkspaceContentState {
  if (!stored) {
    return fallback;
  }

  return {
    faqs: Array.isArray(stored.faqs) ? stored.faqs : fallback.faqs,
    forumThreads: Array.isArray(stored.forumThreads) ? stored.forumThreads : fallback.forumThreads,
    forumPosts: Array.isArray(stored.forumPosts) ? stored.forumPosts : fallback.forumPosts,
    featureRequestVotes: Array.isArray(stored.featureRequestVotes)
      ? stored.featureRequestVotes
      : fallback.featureRequestVotes,
    updateLogs: Array.isArray(stored.updateLogs) ? stored.updateLogs : fallback.updateLogs,
    comingSoonItems: Array.isArray(stored.comingSoonItems)
      ? stored.comingSoonItems
      : fallback.comingSoonItems,
    sops: Array.isArray(stored.sops) ? stored.sops : fallback.sops,
    notifications: Array.isArray(stored.notifications) ? stored.notifications : fallback.notifications,
    greenMachines: Array.isArray(stored.greenMachines) ? stored.greenMachines : fallback.greenMachines,
    greenMachineEvents: Array.isArray(stored.greenMachineEvents)
      ? stored.greenMachineEvents
      : fallback.greenMachineEvents,
  };
}

function sortByRecent<T extends { updatedAt?: string; createdAt?: string; publishedAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTimestamp = new Date(left.updatedAt ?? left.createdAt ?? left.publishedAt ?? 0).getTime();
    const rightTimestamp = new Date(right.updatedAt ?? right.createdAt ?? right.publishedAt ?? 0).getTime();
    return rightTimestamp - leftTimestamp;
  });
}

function getNotificationTarget(role: NotificationTarget | "thread_creator" | null | undefined, threadCreatorId: string) {
  if (!role || role === "thread_creator") {
    return threadCreatorId;
  }

  return role;
}

export function WorkspaceContentProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { session, effectiveRole } = useAuth();
  const demoModeEnabled = isWorkspaceContentDemoModeEnabled();
  const initialState = useMemo(
    () => (demoModeEnabled ? createSeedWorkspaceContentState() : createDefaultWorkspaceContentState()),
    [demoModeEnabled],
  );
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<WorkspaceContentState>(() => initialState);
  const [browserSupabase] = useState(() =>
    demoModeEnabled ? null : createBrowserSupabaseClient(),
  );
  const loadVersion = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refreshWorkspace = useCallback(async () => {
    const version = ++loadVersion.current;
    if (browserSupabase && !demoModeEnabled) {
      const remote = await fetchWorkspaceContentState(browserSupabase, session?.id);
      if (version === loadVersion.current) {
        setState(remote);
        setLoadError(null);
        setHydrated(true);
      }
    }
  }, [browserSupabase, demoModeEnabled, session?.id]);

  useEffect(() => {
    let active = true;
    const version = ++loadVersion.current;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      const hydrate = async () => {
        if (demoModeEnabled) {
          const stored = safeParseWorkspaceContentState(
            window.localStorage.getItem(workspaceContentStorageKey),
          );
          const nextState = purgeExpiredForumThreads(
            purgeExpiredGreenMachines(hydrateWorkspaceContentState(stored, initialState)),
          );
          setState(nextState);
          setHydrated(true);
          return;
        }

        setHydrated(false);
        setLoadError(null);
        if (!session?.id) {
          setState(createDefaultWorkspaceContentState());
          return;
        }

        try {
          const remoteState = await fetchWorkspaceContentState(browserSupabase!, session?.id);
          if (active && version === loadVersion.current) {
            setLoadError(null);
            setState(remoteState);
          }
        } catch (error) {
          console.warn(
            error instanceof Error
              ? error.message
              : "Failed to load shared workspace content from Supabase.",
          );
          if (active && version === loadVersion.current) {
            setLoadError("Shared workspace data could not be loaded. Retry before making changes.");
            setState(createDefaultWorkspaceContentState());
          }
        } finally {
          if (active) {
            setHydrated(true);
          }
        }
      };

      void hydrate();
    });

    return () => {
      active = false;
    };
  }, [browserSupabase, demoModeEnabled, initialState, session?.id]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (demoModeEnabled) {
      window.localStorage.setItem(workspaceContentStorageKey, JSON.stringify(state));
    }
  }, [demoModeEnabled, hydrated, state]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!demoModeEnabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setState((current) => purgeExpiredForumThreads(purgeExpiredGreenMachines(current)));
    }, 60 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [demoModeEnabled, hydrated]);

  const currentUserId = session?.id ?? "system";
  const canManageGreenMachines = effectiveRole === "admin" || effectiveRole === "manager";
  const canRecordGreenMachineEvents = canManageGreenMachines || effectiveRole === "technician";
  const updateGreenMachineState = useCallback(
    (updater: (current: WorkspaceContentState) => WorkspaceContentState) => {
      if (!demoModeEnabled) return;
      setState((current: WorkspaceContentState) =>
        demoModeEnabled ? purgeExpiredForumThreads(purgeExpiredGreenMachines(updater(current))) : updater(current),
      );
    },
    [demoModeEnabled],
  );

  const persist = async (write: () => Promise<unknown>) => {
    ++loadVersion.current; // An older hydration must not overwrite this mutation.
    if (demoModeEnabled) return true;
    try {
      if (!browserSupabase || !session?.id || !hydrated || loadError) throw new Error("Shared workspace is unavailable. Reload before making changes.");
      await write();
      try {
        await refreshWorkspace();
      } catch {
        setLoadError("Change saved, but shared workspace data could not be reloaded. Retry before making further changes.");
        toast.error("Change saved. Workspace reload failed; retry to see current data.");
      }
      return true;
    } catch (error) {
      toast.error((error as { message?: string }).message ?? "Workspace change was not saved.");
      try { await refreshWorkspace(); } catch { setLoadError("Shared workspace data could not be loaded. Retry before making changes."); }
      return false;
    }
  };

  const syncWorkspaceRecord = (payload: WorkspaceContentPayload, mode?: "create" | "update" | "restore") =>
    persist(() => upsertWorkspaceRecord(browserSupabase!, payload, currentUserId,
      mode ?? (Object.values(state).some((items) => items.some((item: { id: string }) => item.id === payload.id)) ? "update" : "create")));

  const archiveWorkspace = (recordId: string, mode: "archived" | "deleted") =>
    persist(() => archiveWorkspaceRecord(browserSupabase!, recordId, currentUserId, mode));

  const pushNotification = async (notification: Omit<Notification, "id" | "createdAt" | "isRead"> & { isRead?: boolean }) => {
    const now = timestamp();
    const nextNotification: Notification = {
      id: crypto.randomUUID(),
      createdAt: now,
      isRead: notification.isRead ?? false,
      ...notification,
    };
    if (!await syncWorkspaceRecord(nextNotification, "create")) return false;
    if (demoModeEnabled) setState((current) => ({
      ...current,
      notifications: [nextNotification, ...current.notifications],
    }));

    return true;
  };

  const saveFaq = async (draft: FaqDraft, mode?: "create" | "update") => {
    const now = timestamp();
    const existingFaq = draft.id ? state.faqs.find((item) => item.id === draft.id) : null;
    const faq: Faq = {
      id: draft.id ?? crypto.randomUUID(),
      question: normalizeText(draft.question),
      answer: normalizeText(draft.answer),
      category: normalizeText(draft.category) || "General",
      sortOrder: Number(draft.sortOrder) || 0,
      isPublished: draft.isPublished,
      createdBy: currentUserId,
      updatedBy: currentUserId,
      createdAt: now,
      updatedAt: now,
    };
    const persistedFaq = existingFaq
      ? { ...faq, createdAt: existingFaq.createdAt, createdBy: existingFaq.createdBy }
      : faq;

    if (!await syncWorkspaceRecord(persistedFaq, mode ?? (draft.id ? "update" : "create"))) return false;
    if (demoModeEnabled) setState((current) => {
      const existing = current.faqs.some((item) => item.id === faq.id);
      const nextFaqs = existing
        ? current.faqs.map((item) => (item.id === faq.id ? { ...item, ...faq, createdAt: item.createdAt, createdBy: item.createdBy } : item))
        : [faq, ...current.faqs];

      return { ...current, faqs: nextFaqs };
    });

    return true;
  };

  const deleteFaq = async (faqId: string) => {
    const now = timestamp();
    if (!await archiveWorkspace(faqId, "deleted")) return false;
    if (demoModeEnabled) setState((current) => ({
      ...current,
      faqs: current.faqs.map((faq) =>
        faq.id === faqId ? { ...faq, isPublished: false, deletedAt: now, archivedAt: null } : faq,
      ),
    }));

    return true;
  };

  const saveUpdateLog = async (draft: UpdateLogDraft, mode?: "create" | "update") => {
    const now = timestamp();
    const existingLog = draft.id ? state.updateLogs.find((item) => item.id === draft.id) : null;
    const log: UpdateLog = {
      id: draft.id ?? crypto.randomUUID(),
      title: normalizeText(draft.title),
      body: normalizeText(draft.body),
      version: normalizeText(draft.version) || null,
      publishedAt: draft.publishedAt || now,
      isPublished: draft.isPublished,
      createdBy: currentUserId,
      updatedBy: currentUserId,
    };
    const persistedLog = existingLog
      ? { ...log, createdBy: existingLog.createdBy, createdAt: existingLog.createdAt }
      : log;

    if (!await syncWorkspaceRecord(persistedLog, mode ?? (draft.id ? "update" : "create"))) return false;
    if (demoModeEnabled) setState((current) => {
      const existing = current.updateLogs.some((item) => item.id === log.id);
      const nextLogs = existing
        ? current.updateLogs.map((item) => (item.id === log.id ? { ...item, ...log } : item))
        : [log, ...current.updateLogs];

      return { ...current, updateLogs: nextLogs };
    });


    if (log.isPublished) {
      pushNotification({
        userId: null,
        roleTarget: "all",
        type: "update_log",
        title: "Update log published",
        body: log.title,
        entityType: "update_log",
        entityId: log.id,
      });
    }
    return true;
  };

  const deleteUpdateLog = async (updateLogId: string) => {
    const now = timestamp();
    if (!await archiveWorkspace(updateLogId, "deleted")) return false;
    if (demoModeEnabled) setState((current) => ({
      ...current,
      updateLogs: current.updateLogs.map((item) =>
        item.id === updateLogId ? { ...item, isPublished: false, deletedAt: now, archivedAt: null } : item,
      ),
    }));

    return true;
  };

  const saveComingSoonItem = async (draft: ComingSoonItemDraft, mode?: "create" | "update") => {
    const now = timestamp();
    const existingItem = draft.id ? state.comingSoonItems.find((item) => item.id === draft.id) : null;
    const item: ComingSoonItem = {
      id: draft.id ?? crypto.randomUUID(),
      title: normalizeText(draft.title),
      description: normalizeText(draft.description),
      status: draft.status,
      targetDate: draft.targetDate || null,
      sortOrder: Number(draft.sortOrder) || 0,
      isPublished: draft.isPublished,
      createdBy: currentUserId,
      updatedBy: currentUserId,
      createdAt: now,
      updatedAt: now,
    };
    const persistedItem = existingItem
      ? { ...item, createdAt: existingItem.createdAt, createdBy: existingItem.createdBy }
      : item;

    if (!await syncWorkspaceRecord(persistedItem, mode ?? (draft.id ? "update" : "create"))) return false;
    if (demoModeEnabled) setState((current) => {
      const existing = current.comingSoonItems.some((entry) => entry.id === item.id);
      const nextItems = existing
        ? current.comingSoonItems.map((entry) =>
            entry.id === item.id ? { ...entry, ...item, createdAt: entry.createdAt } : entry,
          )
        : [item, ...current.comingSoonItems];
      return { ...current, comingSoonItems: nextItems };
    });

    return true;
  };

  const deleteComingSoonItem = async (itemId: string) => {
    const now = timestamp();
    if (!await archiveWorkspace(itemId, "deleted")) return false;
    if (demoModeEnabled) setState((current) => ({
      ...current,
      comingSoonItems: current.comingSoonItems.map((item) =>
        item.id === itemId ? { ...item, isPublished: false, deletedAt: now, archivedAt: null } : item,
      ),
    }));

    return true;
  };

  const saveSop = async (draft: SopDraft) => {
    const now = timestamp();
    const existingSop = draft.id ? state.sops.find((item) => item.id === draft.id) : null;
    const sop: Sop = {
      id: draft.id ?? crypto.randomUUID(),
      title: normalizeText(draft.title),
      body: normalizeText(draft.body),
      category: normalizeText(draft.category) || "General",
      roleVisibility: draft.roleVisibility,
      isPublished: draft.isPublished,
      createdBy: currentUserId,
      updatedBy: currentUserId,
      createdAt: now,
      updatedAt: now,
    };
    const persistedSop = existingSop
      ? { ...sop, createdAt: existingSop.createdAt, createdBy: existingSop.createdBy }
      : sop;

    if (!await syncWorkspaceRecord(persistedSop, draft.id ? "update" : "create")) return false;
    if (demoModeEnabled) setState((current) => {
      const existing = current.sops.some((item) => item.id === sop.id);
      const nextSops = existing
        ? current.sops.map((item) => (item.id === sop.id ? { ...item, ...sop, createdAt: item.createdAt, createdBy: item.createdBy } : item))
        : [sop, ...current.sops];
      return { ...current, sops: nextSops };
    });

    return true;
  };

  const deleteSop = async (sopId: string) => {
    const now = timestamp();
    if (!await archiveWorkspace(sopId, "deleted")) return false;
    if (demoModeEnabled) setState((current) => ({
      ...current,
      sops: current.sops.map((item) =>
        item.id === sopId ? { ...item, isPublished: false, deletedAt: now, archivedAt: null } : item,
      ),
    }));

    return true;
  };

  const saveForumThread = async (draft: ForumThreadDraft) => {
    const now = timestamp();
    const threadId = draft.id ?? crypto.randomUUID();
    const existingThread = draft.id ? state.forumThreads.find((item) => item.id === draft.id) : null;
    const nextArchivedAt = draft.status === "archived" ? now : null;
    const nextDeletedAt = draft.status === "deleted" ? now : null;
    const thread: ForumThread = {
      id: threadId,
      title: normalizeText(draft.title),
      body: normalizeText(draft.body),
      type: draft.type,
      status: draft.status,
      createdBy: currentUserId,
      assignedTo: draft.assignedTo ?? null,
      isPinned: Boolean(draft.isPinned),
      isLocked: Boolean(draft.isLocked),
      createdAt: now,
      updatedAt: now,
      archivedAt: nextArchivedAt,
      deletedAt: nextDeletedAt,
    };
    const persistedThread = existingThread
      ? {
          ...thread,
          createdAt: existingThread.createdAt,
          createdBy: existingThread.createdBy,
          archivedAt: draft.status === "archived" ? existingThread.archivedAt ?? now : null,
          deletedAt: draft.status === "deleted" ? existingThread.deletedAt ?? now : null,
        }
      : thread;

    if (!await syncWorkspaceRecord(persistedThread, draft.id ? "update" : "create")) return null;
    if (demoModeEnabled) setState((current) => {
      const existing = current.forumThreads.find((item) => item.id === thread.id);
      const nextThreads = existing
        ? current.forumThreads.map((item) =>
            item.id === thread.id
              ? {
                  ...item,
                  ...thread,
                  createdAt: item.createdAt,
                  createdBy: item.createdBy,
                  archivedAt:
                    draft.status === "archived"
                      ? item.status === "archived"
                        ? item.archivedAt ?? now
                        : now
                      : null,
                  deletedAt:
                    draft.status === "deleted"
                      ? item.status === "deleted"
                        ? item.deletedAt ?? now
                        : now
                      : null,
                }
              : item,
          )
        : [thread, ...current.forumThreads];

      return { ...current, forumThreads: nextThreads };
    });


    if (!draft.id && (thread.type === "support" || thread.type === "feature_request")) {
      pushNotification({
        userId: null,
        roleTarget: "admin",
        type: thread.type,
        title: thread.type === "support" ? "New support request" : "New feature request",
        body: thread.title,
        entityType: "forum_thread",
        entityId: thread.id,
      });

      pushNotification({
        userId: currentUserId,
        roleTarget: "all",
        type: "request_ack",
        title: thread.type === "support" ? "Support request submitted" : "Feature request submitted",
        body: thread.title,
        entityType: "forum_thread",
        entityId: thread.id,
      });
    }

    return threadId;
  };

  const addForumPost = async (threadId: string, draft: ForumPostDraft) => {
    const now = timestamp();
    const post: ForumPost = {
      id: crypto.randomUUID(),
      threadId,
      body: normalizeText(draft.body),
      createdBy: currentUserId,
      updatedBy: currentUserId,
      createdAt: now,
      updatedAt: now,
      taggedTarget: draft.taggedTarget ?? null,
    };

    const thread = state.forumThreads.find((item) => item.id === threadId);
    if (!thread || thread.status === "archived" || thread.status === "deleted") {
      return false;
    }

    if (!await syncWorkspaceRecord(post, "create")) return false;

    if (demoModeEnabled) setState((current) => {
      const thread = current.forumThreads.find((item) => item.id === threadId);
      if (!thread) {
        return current;
      }

      if (thread.status === "archived" || thread.status === "deleted") {
        return current;
      }

      const nextThreads = current.forumThreads.map((item) =>
        item.id === threadId ? { ...item, updatedAt: now } : item,
      );

      return {
        ...current,
        forumThreads: nextThreads,
        forumPosts: [post, ...current.forumPosts],
      };
    });
    const target = getNotificationTarget(draft.taggedTarget, thread.createdBy);

    if (target === "admin" || target === "manager" || target === "technician" || target === "viewer" || target === "all") {
      pushNotification({
        userId: null,
        roleTarget: target,
        type: "forum_reply",
        title: "Forum reply added",
        body: thread.title,
        entityType: "forum_thread",
        entityId: thread.id,
      });
    } else {
      pushNotification({
        userId: target,
        roleTarget: "all",
        type: "forum_reply",
        title: "Forum reply added",
        body: thread.title,
        entityType: "forum_thread",
        entityId: thread.id,
      });
    }
    return true;
  };

  const setForumThreadStatus = async (threadId: string, status: ForumThread["status"]) => {
    const now = timestamp();
    const existingThread = state.forumThreads.find((item) => item.id === threadId);
    const nextThread = existingThread
      ? {
          ...existingThread,
          status,
          purgeAfter: null,
          updatedAt: now,
          archivedAt: status === "archived" ? existingThread.archivedAt ?? now : null,
          deletedAt: status === "deleted" ? existingThread.deletedAt ?? now : null,
        }
      : null;
    if (!nextThread || !await syncWorkspaceRecord(nextThread,
      existingThread?.archivedAt || existingThread?.deletedAt || existingThread?.purgeAfter ? "restore" : "update")) return false;
    if (demoModeEnabled) setState((current) => {
      const thread = current.forumThreads.find((item) => item.id === threadId);
      if (!thread) {
        return current;
      }

      return {
        ...current,
        forumThreads: current.forumThreads.map((item) =>
          item.id === threadId
            ? {
                ...item,
                status,
                updatedAt: now,
                archivedAt:
                  status === "archived" ? (item.status === "archived" ? item.archivedAt ?? now : now) : null,
                deletedAt:
                  status === "deleted" ? (item.status === "deleted" ? item.deletedAt ?? now : now) : null,
              }
            : item,
        ),
      };
    });


    const thread = state.forumThreads.find((item) => item.id === threadId);
    if (thread) {
      pushNotification({
        userId: thread.createdBy,
        roleTarget: "all",
        type: "thread_status",
        title: "Thread status changed",
        body: `${thread.title} is now ${status.replace(/_/g, " ")}`,
        entityType: "forum_thread",
        entityId: threadId,
      });
    }
    return true;
  };

  const setForumThreadPinned = async (threadId: string, pinned: boolean) => {
    const now = timestamp();
    const thread = state.forumThreads.find((item) => item.id === threadId);
    if (!thread || !await syncWorkspaceRecord({ ...thread, isPinned: pinned, updatedAt: now })) return false;
    if (demoModeEnabled) setState((current) => ({
      ...current,
      forumThreads: current.forumThreads.map((item) =>
        item.id === threadId ? { ...item, isPinned: pinned, updatedAt: now } : item,
      ),
    }));

    return true;
  };

  const setForumThreadLocked = async (threadId: string, locked: boolean) => {
    const now = timestamp();
    const thread = state.forumThreads.find((item) => item.id === threadId);
    if (!thread || !await syncWorkspaceRecord({ ...thread, isLocked: locked, updatedAt: now })) return false;
    if (demoModeEnabled) setState((current) => ({
      ...current,
      forumThreads: current.forumThreads.map((item) =>
        item.id === threadId ? { ...item, isLocked: locked, updatedAt: now } : item,
      ),
    }));

    return true;
  };

  const voteFeatureRequest = async (threadId: string, vote: 1 | -1) => {
    const now = timestamp();
    const existingVote = state.featureRequestVotes.find(
      (item) => item.featureRequestId === threadId && item.userId === currentUserId,
    );
    const nextVote = existingVote
      ? { ...existingVote, vote }
      : {
          id: crypto.randomUUID(),
          featureRequestId: threadId,
          userId: currentUserId,
          vote,
          createdAt: now,
        };
    if (!await syncWorkspaceRecord(nextVote)) return false;
    if (demoModeEnabled) setState((current) => {
      const nextVotes = [...current.featureRequestVotes];
      const existingIndex = nextVotes.findIndex(
        (item) => item.featureRequestId === threadId && item.userId === currentUserId,
      );

      if (existingIndex >= 0) {
        nextVotes[existingIndex] = nextVote;
      } else {
        nextVotes.unshift(nextVote);
      }

      return { ...current, featureRequestVotes: nextVotes };
    });

    return true;
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!await persist(() => markWorkspaceNotificationRead(browserSupabase!, notificationId, currentUserId))) return false;
    if (demoModeEnabled) setState((current) => ({ ...current, notifications: current.notifications.map((item) =>
      item.id === notificationId ? { ...item, isRead: true } : item) }));
    return true;
  };
  const markAllNotificationsRead = async () => {
    const inbox = state.notifications.filter((item) => !item.archivedAt && !item.deletedAt &&
      (item.userId ? item.userId === currentUserId : item.roleTarget === "all" || item.roleTarget === effectiveRole));
    for (const notification of inbox) {
      if (!notification.isRead && !await markNotificationRead(notification.id)) return false;
    }
    return true;
  };
  const setNotificationLifecycle = async (notificationId: string, mode: "archived" | "deleted" | "restored") => {
    const now = timestamp();
    if (!await persist(() => setWorkspaceNotificationLifecycle(browserSupabase!, notificationId, currentUserId, mode))) return false;
    if (demoModeEnabled) setState((current) => ({
      ...current,
      notifications: current.notifications.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              archivedAt: mode === "archived" ? now : null,
              deletedAt: mode === "deleted" ? now : null,
              purgeAfter: mode === "restored" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }
          : notification,
      ),
    }));

    return true;
  };
  const saveGreenMachine = async (draft: GreenMachineDraft) => {
    if (!canManageGreenMachines) {
      return null;
    }

    const now = timestamp();
    const machineId = draft.id ?? crypto.randomUUID();
    const existing = state.greenMachines.find((item) => item.id === machineId);
    const nextStatus = draft.status;
    const existingRestorableStatus =
      existing?.status === "archived" ? existing.archivedStatus ?? "active" : existing?.status ?? "active";
    const machine: GreenMachine = {
      readyForDisposalAt: existing?.readyForDisposalAt ?? null,
      id: machineId,
      modelId: draft.modelId || null,
      modelName: normalizeText(draft.modelName),
      seriesFamily: normalizeText(draft.seriesFamily),
      serialNumber: normalizeText(draft.serialNumber) || null,
      locationId: draft.locationId || null,
      status: nextStatus,
      notes: normalizeText(draft.notes),
      qrToken: existing?.qrToken ?? crypto.randomUUID(),
      createdBy: existing?.createdBy ?? currentUserId,
      updatedBy: currentUserId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      archivedAt:
        nextStatus === "archived"
          ? existing?.status === "archived"
            ? existing.archivedAt ?? now
            : now
          : null,
      archivedStatus: nextStatus === "archived" ? existingRestorableStatus : null,
    };

    if (!await syncWorkspaceRecord(machine, draft.id ? "update" : "create")) return null;
    updateGreenMachineState((current) => {
      const nextMachines = existing
        ? current.greenMachines.map((item) => (item.id === machineId ? machine : item))
        : [machine, ...current.greenMachines];

      return { ...current, greenMachines: nextMachines };
    });


    return machineId;
  };

  const archiveGreenMachine = async (machineId: string) => {
    if (!canManageGreenMachines) {
      return;
    }

    const now = timestamp();
    const machine = state.greenMachines.find((item) => item.id === machineId);
    if (!machine) return false;
    if (machine) {
      if (!await syncWorkspaceRecord({
        ...machine,
        status: "archived",
        archivedAt: machine.archivedAt ?? now,
        archivedStatus: machine.status === "archived" ? machine.archivedStatus ?? "active" : machine.status,
        updatedAt: now,
        updatedBy: currentUserId,
      })) return false;
    }
    updateGreenMachineState((current) => ({
      ...current,
      greenMachines: current.greenMachines.map((item) =>
        item.id === machineId
          ? {
              ...item,
              status: "archived",
              archivedAt: now,
              archivedStatus:
                item.status === "archived" ? item.archivedStatus ?? "active" : item.status,
              updatedAt: now,
              updatedBy: currentUserId,
            }
          : item,
      ),
    }));
    return true;
  };
  const deleteGreenMachine = async (machineId: string) => {
    if (!canManageGreenMachines) {
      return;
    }

    const deletedAt = timestamp();
    const purgeAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (!await archiveWorkspace(machineId, "deleted")) return false;
    updateGreenMachineState((current) => ({
      ...current,
      greenMachines: current.greenMachines.map((item) =>
        item.id === machineId
          ? { ...item, status: "archived", archivedAt: null, deletedAt, purgeAfter }
          : item,
      ),
      greenMachineEvents: current.greenMachineEvents,
    }));

    return true;
  };

  const restoreGreenMachine = async (machineId: string) => {
    if (!canManageGreenMachines) {
      return false;
    }

    const now = timestamp();
    const machine = state.greenMachines.find((item) => item.id === machineId);
    if (!machine) return false;
    if (!await syncWorkspaceRecord({
      ...machine, status: getGreenMachineRestoreStatus(machine), archivedAt: null,
      deletedAt: null, purgeAfter: null, archivedStatus: null, updatedAt: now, updatedBy: currentUserId,
    }, "restore")) return false;
    updateGreenMachineState((current) => ({
      ...current,
      greenMachines: current.greenMachines.map((item) =>
        item.id === machineId
          ? {
              ...item,
              status: getGreenMachineRestoreStatus(item),
              archivedAt: null,
              archivedStatus: null,
              updatedAt: now,
              updatedBy: currentUserId,
            }
          : item,
      ),
    }));
    return true;
  };

  const addGreenMachineEvent = async (machineId: string, draft: GreenMachineEventDraft) => {
    if (!canRecordGreenMachineEvents) {
      return Promise.resolve();
    }

    const now = timestamp();
    const event: GreenMachineEvent = {
      id: crypto.randomUUID(),
      machineId,
      eventType: draft.eventType,
      partId: draft.partId || null,
      partName: normalizeText(draft.partName) || null,
      partCategory: normalizeText(draft.partCategory) || null,
      quantity: draft.quantity ? Math.max(1, Number(draft.quantity) || 1) : null,
      condition: normalizeText(draft.condition) || null,
      note: normalizeText(draft.note),
      createdBy: currentUserId,
      createdAt: now,
      batchId: draft.batchId ?? null,
    };

    if (!await syncWorkspaceRecord(event, "create")) throw new Error("Machine event was not saved.");
    updateGreenMachineState((current) => ({
      ...current,
      greenMachineEvents: [event, ...current.greenMachineEvents],
      greenMachines: current.greenMachines.map((machine) =>
        machine.id === machineId
          ? {
              ...machine,
              updatedAt: now,
              updatedBy: currentUserId,
              notes:
                draft.eventType === "note" && draft.note
                  ? `${machine.notes}\n${draft.note}`.trim()
                  : machine.notes,
            }
          : machine,
      ),
    }));

  };

  const publishedFaqs = useMemo(
    () =>
      sortByRecent(
        state.faqs.filter((faq) => faq.isPublished && !faq.archivedAt && !faq.deletedAt),
      ).sort((left, right) => left.sortOrder - right.sortOrder),
    [state.faqs],
  );

  const visibleSops = useMemo(
    () =>
      sortByRecent(
        state.sops.filter(
          (sop) =>
            sop.isPublished &&
            !sop.archivedAt &&
            !sop.deletedAt &&
            (sop.roleVisibility === "all" || sop.roleVisibility === effectiveRole),
        ),
      ),
    [effectiveRole, state.sops],
  );

  const publishedUpdateLogs = useMemo(
    () => sortByRecent(state.updateLogs.filter((log) => log.isPublished && !log.archivedAt && !log.deletedAt)),
    [state.updateLogs],
  );

  const publishedComingSoonItems = useMemo(
    () =>
      sortByRecent(
        state.comingSoonItems.filter(
          (item) => item.isPublished && !item.archivedAt && !item.deletedAt,
        ),
      ).sort(
        (left, right) => left.sortOrder - right.sortOrder,
      ),
    [state.comingSoonItems],
  );

  const supportThreads = useMemo(
    () =>
      [...state.forumThreads]
        .filter((thread) => thread.type === "support")
        .sort((left, right) => {
          if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
          return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
        }),
    [state.forumThreads],
  );

  const featureRequests = useMemo(
    () =>
      [...state.forumThreads]
        .filter((thread) => thread.type === "feature_request")
        .sort((left, right) => {
          if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
          return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
        }),
    [state.forumThreads],
  );

  const visibleNotifications = useMemo(() => {
    return [...state.notifications]
      .filter((notification) => {
        if (notification.deletedAt || notification.archivedAt) {
          return false;
        }

        if (notification.userId) return notification.userId === currentUserId;

        if (notification.roleTarget === "all") {
          return true;
        }

        return notification.roleTarget === effectiveRole;
      })
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [currentUserId, effectiveRole, state.notifications]);

  const unreadNotificationCount = useMemo(
    () => visibleNotifications.filter((notification) => !notification.isRead).length,
    [visibleNotifications],
  );

  const getThreadById = (threadId: string) =>
    state.forumThreads.find((thread) => thread.id === threadId) ?? null;

  const getGreenMachineById = (machineId: string) =>
    state.greenMachines.find((machine) => machine.id === machineId && !machine.deletedAt) ?? null;

  const getThreadPosts = (threadId: string) =>
    [...state.forumPosts]
      .filter((post) => post.threadId === threadId)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  const getFeatureRequestScore = (threadId: string) =>
    state.featureRequestVotes
      .filter((vote) => vote.featureRequestId === threadId)
      .reduce((sum, vote) => sum + vote.vote, 0);

  const greenMachineEventsFor = (machineId: string) =>
    [...state.greenMachineEvents]
      .filter((event) => event.machineId === machineId)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  const value: WorkspaceContentContextValue = {
    ...state,
    faqs: state.faqs.filter((item) => !item.archivedAt && !item.deletedAt && !item.purgeAfter),
    sops: state.sops.filter((item) => !item.archivedAt && !item.deletedAt && !item.purgeAfter),
    updateLogs: state.updateLogs.filter((item) => !item.archivedAt && !item.deletedAt && !item.purgeAfter),
    comingSoonItems: state.comingSoonItems.filter((item) => !item.archivedAt && !item.deletedAt && !item.purgeAfter),
    greenMachines: state.greenMachines.filter((machine) => !machine.deletedAt),
    hydrated,
    visibleNotifications,
    unreadNotificationCount,
    publishedFaqs,
    visibleSops,
    publishedUpdateLogs,
    publishedComingSoonItems,
    supportThreads,
    featureRequests,
    greenMachineEventsFor,
    refreshWorkspace,
    getThreadById,
    getGreenMachineById,
    getThreadPosts,
    getFeatureRequestScore,
    saveFaq,
    deleteFaq,
    saveUpdateLog,
    deleteUpdateLog,
    saveComingSoonItem,
    deleteComingSoonItem,
    saveSop,
    deleteSop,
    saveForumThread,
    addForumPost,
    setForumThreadStatus,
    setForumThreadPinned,
    setForumThreadLocked,
    voteFeatureRequest,
    markNotificationRead,
    markAllNotificationsRead,
    archiveNotification: (notificationId: string) => setNotificationLifecycle(notificationId, "archived"),
    deleteNotification: (notificationId: string) => setNotificationLifecycle(notificationId, "deleted"),
    restoreNotification: (notificationId: string) => setNotificationLifecycle(notificationId, "restored"),
    saveGreenMachine,
    archiveGreenMachine,
    deleteGreenMachine,
    restoreGreenMachine,
    addGreenMachineEvent,
  };

  return <WorkspaceContentContext.Provider value={value}>
    {loadError && <div role="alert" className="p-4 text-red-400">{loadError} <button type="button" onClick={() => void refreshWorkspace().catch(() => toast.error("Workspace reload failed."))}>Retry</button></div>}
    {children}
  </WorkspaceContentContext.Provider>;
}

export function useWorkspaceContent() {
  const context = useContext(WorkspaceContentContext);
  if (!context) {
    throw new Error("useWorkspaceContent must be used within a WorkspaceContentProvider");
  }

  return context;
}
