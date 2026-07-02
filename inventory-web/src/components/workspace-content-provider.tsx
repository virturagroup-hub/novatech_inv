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
import {
  createSeedWorkspaceContentState,
  workspaceContentStorageKey,
} from "@/lib/workspace-content-seed";
import {
  getGreenMachineRestoreStatus,
  purgeExpiredGreenMachines,
} from "@/lib/green-machine-retention";
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
  saveGreenMachine: (draft: GreenMachineDraft) => string;
  archiveGreenMachine: (machineId: string) => void;
  restoreGreenMachine: (machineId: string) => void;
  addGreenMachineEvent: (machineId: string, draft: GreenMachineEventDraft) => void;
};

const WorkspaceContentContext = createContext<WorkspaceContentContextValue | null>(null);

function timestamp() {
  return new Date().toISOString();
}

function normalizeText(value: string) {
  return value.trim();
}

function safeParseWorkspaceContentState(raw: string | null): WorkspaceContentState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as WorkspaceContentState;

    if (
      parsed &&
      Array.isArray(parsed.faqs) &&
      Array.isArray(parsed.forumThreads) &&
      Array.isArray(parsed.forumPosts) &&
      Array.isArray(parsed.featureRequestVotes) &&
      Array.isArray(parsed.updateLogs) &&
      Array.isArray(parsed.comingSoonItems) &&
      Array.isArray(parsed.sops) &&
      Array.isArray(parsed.notifications) &&
      Array.isArray(parsed.greenMachines) &&
      Array.isArray(parsed.greenMachineEvents)
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
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
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<WorkspaceContentState>(() => createSeedWorkspaceContentState());

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      const stored = safeParseWorkspaceContentState(window.localStorage.getItem(workspaceContentStorageKey));
      const nextState = purgeExpiredGreenMachines(stored ?? createSeedWorkspaceContentState());
      setState(nextState);
      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(workspaceContentStorageKey, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setState((current) => purgeExpiredGreenMachines(current));
    }, 60 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hydrated]);

  const currentUserId = session?.id ?? "system";
  const canManageGreenMachines = effectiveRole === "admin" || effectiveRole === "manager";
  const canRecordGreenMachineEvents = canManageGreenMachines || effectiveRole === "technician";
  const updateGreenMachineState = useCallback(
    (updater: (current: WorkspaceContentState) => WorkspaceContentState) => {
      setState((current: WorkspaceContentState) => purgeExpiredGreenMachines(updater(current)));
    },
    [],
  );

  const pushNotification = (notification: Omit<Notification, "id" | "createdAt" | "isRead"> & { isRead?: boolean }) => {
    const now = timestamp();
    setState((current) => ({
      ...current,
      notifications: [
        {
          id: crypto.randomUUID(),
          createdAt: now,
          isRead: notification.isRead ?? false,
          ...notification,
        },
        ...current.notifications,
      ],
    }));
  };

  const saveFaq = (draft: FaqDraft) => {
    const now = timestamp();
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

    setState((current) => {
      const existing = current.faqs.some((item) => item.id === faq.id);
      const nextFaqs = existing
        ? current.faqs.map((item) => (item.id === faq.id ? { ...item, ...faq, createdAt: item.createdAt, createdBy: item.createdBy } : item))
        : [faq, ...current.faqs];

      return { ...current, faqs: nextFaqs };
    });
  };

  const deleteFaq = (faqId: string) => {
    setState((current) => ({
      ...current,
      faqs: current.faqs.filter((faq) => faq.id !== faqId),
    }));
  };

  const saveUpdateLog = (draft: UpdateLogDraft) => {
    const now = timestamp();
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

    setState((current) => {
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
  };

  const deleteUpdateLog = (updateLogId: string) => {
    setState((current) => ({
      ...current,
      updateLogs: current.updateLogs.filter((item) => item.id !== updateLogId),
    }));
  };

  const saveComingSoonItem = (draft: ComingSoonItemDraft) => {
    const now = timestamp();
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

    setState((current) => {
      const existing = current.comingSoonItems.some((entry) => entry.id === item.id);
      const nextItems = existing
        ? current.comingSoonItems.map((entry) =>
            entry.id === item.id ? { ...entry, ...item, createdAt: entry.createdAt } : entry,
          )
        : [item, ...current.comingSoonItems];
      return { ...current, comingSoonItems: nextItems };
    });
  };

  const deleteComingSoonItem = (itemId: string) => {
    setState((current) => ({
      ...current,
      comingSoonItems: current.comingSoonItems.filter((item) => item.id !== itemId),
    }));
  };

  const saveSop = (draft: SopDraft) => {
    const now = timestamp();
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

    setState((current) => {
      const existing = current.sops.some((item) => item.id === sop.id);
      const nextSops = existing
        ? current.sops.map((item) => (item.id === sop.id ? { ...item, ...sop, createdAt: item.createdAt, createdBy: item.createdBy } : item))
        : [sop, ...current.sops];
      return { ...current, sops: nextSops };
    });
  };

  const deleteSop = (sopId: string) => {
    setState((current) => ({
      ...current,
      sops: current.sops.filter((item) => item.id !== sopId),
    }));
  };

  const saveForumThread = (draft: ForumThreadDraft) => {
    const now = timestamp();
    const threadId = draft.id ?? crypto.randomUUID();
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
    };

    setState((current) => {
      const existing = current.forumThreads.find((item) => item.id === thread.id);
      const nextThreads = existing
        ? current.forumThreads.map((item) => (item.id === thread.id ? { ...item, ...thread, createdAt: item.createdAt, createdBy: item.createdBy } : item))
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
    if (!thread) {
      return;
    }

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
    setState((current) => {
      const thread = current.forumThreads.find((item) => item.id === threadId);
      if (!thread) {
        return current;
      }

      return {
        ...current,
        forumThreads: current.forumThreads.map((item) =>
          item.id === threadId ? { ...item, status, updatedAt: now } : item,
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
  };

  const setForumThreadPinned = (threadId: string, pinned: boolean) => {
    const now = timestamp();
    setState((current) => ({
      ...current,
      forumThreads: current.forumThreads.map((item) =>
        item.id === threadId ? { ...item, isPinned: pinned, updatedAt: now } : item,
      ),
    }));
  };

  const setForumThreadLocked = (threadId: string, locked: boolean) => {
    const now = timestamp();
    setState((current) => ({
      ...current,
      forumThreads: current.forumThreads.map((item) =>
        item.id === threadId ? { ...item, isLocked: locked, updatedAt: now } : item,
      ),
    }));
  };

  const voteFeatureRequest = (threadId: string, vote: 1 | -1) => {
    const now = timestamp();
    setState((current) => {
      const nextVotes = [...current.featureRequestVotes];
      const existingIndex = nextVotes.findIndex(
        (item) => item.featureRequestId === threadId && item.userId === currentUserId,
      );

      if (existingIndex >= 0) {
        nextVotes[existingIndex] = {
          ...nextVotes[existingIndex],
          vote,
          createdAt: nextVotes[existingIndex].createdAt,
        };
      } else {
        nextVotes.unshift({
          id: crypto.randomUUID(),
          featureRequestId: threadId,
          userId: currentUserId,
          vote,
          createdAt: now,
        });
      }

      return { ...current, featureRequestVotes: nextVotes };
    });
  };

  const markNotificationRead = (notificationId: string) => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((item) =>
        item.id === notificationId ? { ...item, isRead: true } : item,
      ),
    }));
  };

  const markAllNotificationsRead = () => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((item) => ({ ...item, isRead: true })),
    }));
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
  };

  const addGreenMachineEvent = (machineId: string, draft: GreenMachineEventDraft) => {
    if (!canRecordGreenMachineEvents) {
      return;
    }

    const now = timestamp();
    const event: GreenMachineEvent = {
      id: crypto.randomUUID(),
      machineId,
      eventType: draft.eventType,
      partId: draft.partId || null,
      partName: normalizeText(draft.partName) || null,
      quantity: draft.quantity ? Math.max(1, Number(draft.quantity) || 1) : null,
      condition: normalizeText(draft.condition) || null,
      note: normalizeText(draft.note),
      createdBy: currentUserId,
      createdAt: now,
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
  };

  const publishedFaqs = useMemo(
    () => sortByRecent(state.faqs.filter((faq) => faq.isPublished)).sort((left, right) => left.sortOrder - right.sortOrder),
    [state.faqs],
  );

  const visibleSops = useMemo(
    () =>
      sortByRecent(
        state.sops.filter(
          (sop) => sop.isPublished && (sop.roleVisibility === "all" || sop.roleVisibility === effectiveRole),
        ),
      ),
    [effectiveRole, state.sops],
  );

  const publishedUpdateLogs = useMemo(
    () => sortByRecent(state.updateLogs.filter((log) => log.isPublished)),
    [state.updateLogs],
  );

  const publishedComingSoonItems = useMemo(
    () =>
      sortByRecent(state.comingSoonItems.filter((item) => item.isPublished)).sort(
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
    saveGreenMachine,
    archiveGreenMachine,
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
