import type { ForumThread, ForumPost, WorkspaceContentState } from "@/lib/workspace-content-types";

export const FORUM_THREAD_ARCHIVE_RETENTION_DAYS = 30;
export const FORUM_THREAD_ARCHIVE_RETENTION_MS =
  FORUM_THREAD_ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseTimestamp(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getThreadRetentionTimestamp(thread: Pick<ForumThread, "status" | "archivedAt" | "deletedAt">) {
  if (thread.status === "archived") {
    return parseTimestamp(thread.archivedAt);
  }

  if (thread.status === "deleted") {
    return parseTimestamp(thread.deletedAt);
  }

  return null;
}

export function getForumThreadArchiveExpiresAt(thread: Pick<ForumThread, "status" | "archivedAt" | "deletedAt">) {
  const timestamp = getThreadRetentionTimestamp(thread);
  if (timestamp === null) {
    return null;
  }

  return new Date(timestamp + FORUM_THREAD_ARCHIVE_RETENTION_MS);
}

export function getForumThreadArchiveDaysRemaining(
  thread: Pick<ForumThread, "status" | "archivedAt" | "deletedAt">,
  now = Date.now(),
) {
  const expiresAt = getForumThreadArchiveExpiresAt(thread);
  if (!expiresAt) {
    return null;
  }

  return Math.max(0, Math.ceil((expiresAt.getTime() - now) / DAY_MS));
}

export function getForumThreadArchiveRetentionLabel(
  thread: Pick<ForumThread, "status" | "archivedAt" | "deletedAt">,
  now = Date.now(),
) {
  const daysRemaining = getForumThreadArchiveDaysRemaining(thread, now);
  if (daysRemaining === null) {
    return null;
  }

  if (daysRemaining === 0) {
    return "Purges today";
  }

  return `Restorable for ${daysRemaining} more day${daysRemaining === 1 ? "" : "s"}`;
}

export function shouldPurgeForumThread(
  thread: Pick<ForumThread, "status" | "archivedAt" | "deletedAt">,
  now = Date.now(),
) {
  const timestamp = getThreadRetentionTimestamp(thread);
  if (timestamp === null) {
    return false;
  }

  return now >= timestamp + FORUM_THREAD_ARCHIVE_RETENTION_MS;
}

export function purgeExpiredForumThreads(state: WorkspaceContentState, now = Date.now()) {
  let stateChanged = false;
  const normalizedThreads = state.forumThreads.map((thread) => {
    if (thread.status === "archived") {
      if (thread.archivedAt) {
        if (thread.deletedAt !== null) {
          stateChanged = true;
          return { ...thread, deletedAt: null };
        }

        return thread;
      }

      stateChanged = true;
      return {
        ...thread,
        archivedAt: new Date(now).toISOString(),
        deletedAt: null,
      };
    }

    if (thread.status === "deleted") {
      if (thread.deletedAt) {
        if (thread.archivedAt !== null) {
          stateChanged = true;
          return { ...thread, archivedAt: null };
        }

        return thread;
      }

      stateChanged = true;
      return {
        ...thread,
        archivedAt: null,
        deletedAt: new Date(now).toISOString(),
      };
    }

    if (thread.archivedAt !== null || thread.deletedAt !== null) {
      stateChanged = true;
      return {
        ...thread,
        archivedAt: null,
        deletedAt: null,
      };
    }

    return thread;
  });

  const expiredThreadIds = new Set(
    normalizedThreads.filter((thread) => shouldPurgeForumThread(thread, now)).map((thread) => thread.id),
  );

  if (expiredThreadIds.size === 0 && !stateChanged) {
    return state;
  }

  return {
    ...state,
    forumThreads: normalizedThreads.filter((thread) => !expiredThreadIds.has(thread.id)),
    forumPosts: state.forumPosts.filter((post: ForumPost) => !expiredThreadIds.has(post.threadId)),
  };
}
