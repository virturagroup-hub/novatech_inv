"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/components/auth-provider";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  archiveWorkspaceRecord,
  fetchWorkspaceContentState,
  markWorkspaceNotificationRead,
  setWorkspaceNotificationLifecycle,
  restoreWorkspaceRecord,
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
  saveFaq: (draft: FaqDraft) => void;
  deleteFaq: (faqId: string) => void;
  saveUpdateLog: (draft: UpdateLogDraft) => void;
  deleteUpdateLog: (updateLogId: string) => void;
  saveComingSoonItem: (draft: ComingSoonItemDraft) => void;
  deleteComingSoonItem: (itemId: string) => void;
  saveSop: (draft: SopDraft) => void;
  deleteSop: (sopId: string) => void;
  saveForumThread: (draft: ForumThreadDraft) => string;
  addForumPost: (threadId: string, draft: ForumPostDraft) => void;
  setForumThreadStatus: (threadId: string, status: ForumThread["status"]) => void;
  setForumThreadPinned: (threadId: string, pinned: boolean) => void;
  setForumThreadLocked: (threadId: string, locked: boolean) => void;
  voteFeatureRequest: (threadId: string, vote: 1 | -1) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  archiveNotification: (notificationId: string) => void;
  deleteNotification: (notificationId: string) => void;
  restoreNotification: (notificationId: string) => void;
  saveGreenMachine: (draft: GreenMachineDraft) => string;
  archiveGreenMachine: (machineId: string) => void;
  deleteGreenMachine: (machineId: string) => void;
  restoreGreenMachine: (machineId: string) => void;
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

  useEffect(() => {
    let active = true;

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

        try {
          const remoteState = await fetchWorkspaceContentState(browserSupabase!, session?.id);
          if (active) {
            setState(remoteState);
          }
        } catch (error) {
          console.warn(
            error instanceof Error
              ? error.message
              : "Failed to load shared workspace content from Supabase.",
          );
          if (active) {
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
      setState((current: WorkspaceContentState) =>
        purgeExpiredForumThreads(purgeExpiredGreenMachines(updater(current))),
      );
    },
    [],
  );

  const syncWorkspaceRecord = useCallback(
    (payload: WorkspaceContentPayload) => {
      if (!browserSupabase || demoModeEnabled) {
        return Promise.resolve();
      }

      return upsertWorkspaceRecord(browserSupabase, payload, currentUserId).catch((error) => {
        console.error(
          error instanceof Error
            ? error.message
            : "Failed to save shared workspace content to Supabase.",
        );
      });
    },
    [browserSupabase, currentUserId, demoModeEnabled],
  );

  const archiveWorkspace = useCallback(
    (recordId: string, mode: "archived" | "deleted") => {
      if (!browserSupabase || demoModeEnabled) {
        return Promise.resolve();
      }

      return archiveWorkspaceRecord(browserSupabase, recordId, currentUserId, mode).catch((error) => {
        console.error(
          error instanceof Error
            ? error.message
            : "Failed to retain shared workspace content in Supabase.",
        );
      });
    },
    [browserSupabase, currentUserId, demoModeEnabled],
  );

  const restoreWorkspace = useCallback(
    (recordId: string) => {
      if (!browserSupabase || demoModeEnabled) {
        return Promise.resolve();
      }

      return restoreWorkspaceRecord(browserSupabase, recordId, currentUserId).catch((error) => {
        console.error(
          error instanceof Error
            ? error.message
            : "Failed to restore shared workspace content in Supabase.",
        );
      });
    },
    [browserSupabase, currentUserId, demoModeEnabled],
  );

  const pushNotification = (notification: Omit<Notification, "id" | "createdAt" | "isRead"> & { isRead?: boolean }) => {
    const now = timestamp();
    const nextNotification: Notification = {
      id: crypto.randomUUID(),
      createdAt: now,
      isRead: notification.isRead ?? false,
      ...notification,
    };
    setState((current) => ({
      ...current,
      notifications: [nextNotification, ...current.notifications],
    }));
    syncWorkspaceRecord(nextNotification);
  };

  const saveFaq = (draft: FaqDraft) => {
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

    setState((current) => {
      const existing = current.faqs.some((item) => item.id === faq.id);
      const nextFaqs = existing
        ? current.faqs.map((item) => (item.id === faq.id ? { ...item, ...faq, createdAt: item.createdAt, createdBy: item.createdBy } : item))
        : [faq, ...current.faqs];

      return { ...current, faqs: nextFaqs };
    });
    syncWorkspaceRecord(persistedFaq);
  };

  const deleteFaq = (faqId: string) => {
    const now = timestamp();
    setState((current) => ({
      ...current,
      faqs: current.faqs.map((faq) =>
        faq.id === faqId ? { ...faq, isPublished: false, deletedAt: now, archivedAt: null } : faq,
      ),
    }));
    archiveWorkspace(faqId, "deleted");
  };

  const saveUpdateLog = (draft: UpdateLogDraft) => {
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

    setState((current) => {
      const existing = current.updateLogs.some((item) => item.id === log.id);
      const nextLogs = existing
        ? current.updateLogs.map((item) => (item.id === log.id ? { ...item, ...log } : item))
        : [log, ...current.updateLogs];

      return { ...current, updateLogs: nextLogs };
    });
    syncWorkspaceRecord(persistedLog);

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
  };

  const deleteUpdateLog = (updateLogId: string) => {
    const now = timestamp();
    setState((current) => ({
      ...current,
      updateLogs: current.updateLogs.map((item) =>
        item.id === updateLogId ? { ...item, isPublished: false, deletedAt: now, archivedAt: null } : item,
      ),
    }));
    archiveWorkspace(updateLogId, "deleted");
  };

  const saveComingSoonItem = (draft: ComingSoonItemDraft) => {
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

    setState((current) => {
      const existing = current.comingSoonItems.some((entry) => entry.id === item.id);
      const nextItems = existing
        ? current.comingSoonItems.map((entry) =>
            entry.id === item.id ? { ...entry, ...item, createdAt: entry.createdAt } : entry,
          )
        : [item, ...current.comingSoonItems];
      return { ...current, comingSoonItems: nextItems };
    });
    syncWorkspaceRecord(persistedItem);
  };

  const deleteComingSoonItem = (itemId: string) => {
    const now = timestamp();
    setState((current) => ({
      ...current,
      comingSoonItems: current.comingSoonItems.map((item) =>
        item.id === itemId ? { ...item, isPublished: false, deletedAt: now, archivedAt: null } : item,
      ),
    }));
    archiveWorkspace(itemId, "deleted");
  };

  const saveSop = (draft: SopDraft) => {
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

    setState((current) => {
      const existing = current.sops.some((item) => item.id === sop.id);
      const nextSops = existing
        ? current.sops.map((item) => (item.id === sop.id ? { ...item, ...sop, createdAt: item.createdAt, createdBy: item.createdBy } : item))
        : [sop, ...current.sops];
      return { ...current, sops: nextSops };
    });
    syncWorkspaceRecord(persistedSop);
  };

  const deleteSop = (sopId: string) => {
    const now = timestamp();
    setState((current) => ({
      ...current,
      sops: current.sops.map((item) =>
        item.id === sopId ? { ...item, isPublished: false, deletedAt: now, archivedAt: null } : item,
      ),
    }));
    archiveWorkspace(sopId, "deleted");
  };

  const saveForumThread = (draft: ForumThreadDraft) => {
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

    setState((current) => {
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
    syncWorkspaceRecord(persistedThread);

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

  const addForumPost = (threadId: string, draft: ForumPostDraft) => {
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

    setState((current) => {
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
    const thread = state.forumThreads.find((item) => item.id === threadId);
    if (!thread || thread.status === "archived" || thread.status === "deleted") {
      return;
    }

    syncWorkspaceRecord(post);

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
  };

  const setForumThreadStatus = (threadId: string, status: ForumThread["status"]) => {
    const now = timestamp();
    const existingThread = state.forumThreads.find((item) => item.id === threadId);
    const nextThread = existingThread
      ? {
          ...existingThread,
          status,
          updatedAt: now,
          archivedAt: status === "archived" ? existingThread.archivedAt ?? now : null,
          deletedAt: status === "deleted" ? existingThread.deletedAt ?? now : null,
        }
      : null;
    setState((current) => {
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
    if (nextThread) {
      syncWorkspaceRecord(nextThread);
    }

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
  };

  const setForumThreadPinned = (threadId: string, pinned: boolean) => {
    const now = timestamp();
    const thread = state.forumThreads.find((item) => item.id === threadId);
    setState((current) => ({
      ...current,
      forumThreads: current.forumThreads.map((item) =>
        item.id === threadId ? { ...item, isPinned: pinned, updatedAt: now } : item,
      ),
    }));
    if (thread) {
      syncWorkspaceRecord({ ...thread, isPinned: pinned, updatedAt: now });
    }
  };

  const setForumThreadLocked = (threadId: string, locked: boolean) => {
    const now = timestamp();
    const thread = state.forumThreads.find((item) => item.id === threadId);
    setState((current) => ({
      ...current,
      forumThreads: current.forumThreads.map((item) =>
        item.id === threadId ? { ...item, isLocked: locked, updatedAt: now } : item,
      ),
    }));
    if (thread) {
      syncWorkspaceRecord({ ...thread, isLocked: locked, updatedAt: now });
    }
  };

  const voteFeatureRequest = (threadId: string, vote: 1 | -1) => {
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
    setState((current) => {
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
    syncWorkspaceRecord(nextVote);
  };

  const markNotificationRead = (notificationId: string) => {
    const notification = state.notifications.find((item) => item.id === notificationId);
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((item) =>
        item.id === notificationId ? { ...item, isRead: true } : item,
      ),
    }));
    if (notification) {
      if (browserSupabase && !demoModeEnabled && session?.id) {
        void markWorkspaceNotificationRead(browserSupabase, notification.id, session.id).catch((error) => {
          console.error(
            error instanceof Error ? error.message : "Failed to mark notification read in Supabase.",
          );
        });
      }
    }
  };

  const markAllNotificationsRead = () => {
    const notifications = state.notifications.map((item) => ({ ...item, isRead: true }));
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((item) => ({ ...item, isRead: true })),
    }));
    if (browserSupabase && !demoModeEnabled && session?.id) {
      notifications.forEach((notification) => {
        void markWorkspaceNotificationRead(browserSupabase, notification.id, session.id).catch((error) => {
          console.error(
            error instanceof Error ? error.message : "Failed to mark notification read in Supabase.",
          );
        });
      });
    }
  };

  const setNotificationLifecycle = (notificationId: string, mode: "archived" | "deleted" | "restored") => {
    const now = timestamp();
    setState((current) => ({
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

    if (browserSupabase && !demoModeEnabled && session?.id) {
      void setWorkspaceNotificationLifecycle(browserSupabase, notificationId, session.id, mode).catch((error) => {
        console.error(
          error instanceof Error ? error.message : "Failed to update notification retention in Supabase.",
        );
      });
    }
  };

  const saveGreenMachine = (draft: GreenMachineDraft) => {
    if (!canManageGreenMachines) {
      return draft.id ?? "";
    }

    const now = timestamp();
    const machineId = draft.id ?? crypto.randomUUID();
    const existing = state.greenMachines.find((item) => item.id === machineId);
    const nextStatus = draft.status;
    const existingRestorableStatus =
      existing?.status === "archived" ? existing.archivedStatus ?? "active" : existing?.status ?? "active";
    const machine: GreenMachine = {
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

    updateGreenMachineState((current) => {
      const nextMachines = existing
        ? current.greenMachines.map((item) => (item.id === machineId ? machine : item))
        : [machine, ...current.greenMachines];

      return { ...current, greenMachines: nextMachines };
    });
    syncWorkspaceRecord(machine);

    return machineId;
  };

  const archiveGreenMachine = (machineId: string) => {
    if (!canManageGreenMachines) {
      return;
    }

    const now = timestamp();
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
    const machine = state.greenMachines.find((item) => item.id === machineId);
    if (machine) {
      syncWorkspaceRecord({
        ...machine,
        status: "archived",
        archivedAt: machine.archivedAt ?? now,
        archivedStatus: machine.status === "archived" ? machine.archivedStatus ?? "active" : machine.status,
        updatedAt: now,
        updatedBy: currentUserId,
      });
    }
  };

  const deleteGreenMachine = (machineId: string) => {
    if (!canManageGreenMachines) {
      return;
    }

    const deletedAt = timestamp();
    const purgeAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    updateGreenMachineState((current) => ({
      ...current,
      greenMachines: current.greenMachines.map((item) =>
        item.id === machineId
          ? { ...item, status: "archived", archivedAt: null, deletedAt, purgeAfter }
          : item,
      ),
      greenMachineEvents: current.greenMachineEvents.filter((event) => event.machineId !== machineId),
    }));
    archiveWorkspace(machineId, "deleted");
  };

  const restoreGreenMachine = (machineId: string) => {
    if (!canManageGreenMachines) {
      return;
    }

    const now = timestamp();
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
    const machine = state.greenMachines.find((item) => item.id === machineId);
    if (machine) {
      syncWorkspaceRecord({
        ...machine,
        status: getGreenMachineRestoreStatus(machine),
        archivedAt: null,
        deletedAt: null,
        purgeAfter: null,
        archivedStatus: null,
        updatedAt: now,
        updatedBy: currentUserId,
      });
      restoreWorkspace(machineId);
    }
  };

  const addGreenMachineEvent = (machineId: string, draft: GreenMachineEventDraft) => {
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
    return syncWorkspaceRecord(event);
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

        if (notification.userId && notification.userId === currentUserId) {
          return true;
        }

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
    state.greenMachines.find((machine) => machine.id === machineId) ?? null;

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

  return <WorkspaceContentContext.Provider value={value}>{children}</WorkspaceContentContext.Provider>;
}

export function useWorkspaceContent() {
  const context = useContext(WorkspaceContentContext);
  if (!context) {
    throw new Error("useWorkspaceContent must be used within a WorkspaceContentProvider");
  }

  return context;
}
