import type { ForumThreadStatus, ForumThreadType } from "./workspace-content-types";

export function getThreadTypeLabel(type: ForumThreadType) {
  switch (type) {
    case "support":
      return "Support";
    case "feature_request":
      return "Feature request";
    case "general":
    default:
      return "Forum";
  }
}

export function formatThreadStatusLabel(
  status: ForumThreadStatus,
  mode: "support" | "forum" | "feature_request",
) {
  switch (status) {
    case "open":
      return mode === "feature_request" ? "New" : "Open";
    case "under_review":
      return "Under review";
    case "planned":
      return "Planned";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "rejected":
      return "Rejected";
    case "closed":
    default:
      return "Closed";
  }
}

export function getThreadStatusBadgeClass(status: ForumThreadStatus) {
  switch (status) {
    case "completed":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
    case "rejected":
    case "closed":
      return "border-rose-400/20 bg-rose-400/10 text-rose-100";
    case "under_review":
    case "planned":
    case "in_progress":
      return "border-amber-400/20 bg-amber-400/10 text-amber-100";
    case "open":
    default:
      return "border-sky-400/20 bg-sky-400/10 text-sky-100";
  }
}
