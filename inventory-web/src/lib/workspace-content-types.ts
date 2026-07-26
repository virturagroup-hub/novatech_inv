import type { UserRole } from "./auth";

export type NotificationTarget = UserRole | "all";

export type ForumThreadType = "support" | "general" | "feature_request";

export type ForumThreadStatus =
  | "open"
  | "under_review"
  | "planned"
  | "in_progress"
  | "completed"
  | "rejected"
  | "closed"
  | "archived"
  | "deleted";

export type GreenMachineStatus =
  | "active"
  | "partially_stripped"
  | "depleted"
  | "scrapped"
  | "archived";

export type RestorableGreenMachineStatus = Exclude<GreenMachineStatus, "archived">;

export type GreenMachineEventType =
  | "taken"
  | "transferred_to_inventory"
  | "note"
  | "status_change";

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
  purgeAfter?: string | null;
}

export interface ForumThread {
  id: string;
  title: string;
  body: string;
  type: ForumThreadType;
  status: ForumThreadStatus;
  createdBy: string;
  assignedTo: string | null;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  purgeAfter?: string | null;
}

export interface ForumPost {
  id: string;
  threadId: string;
  body: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  taggedTarget?: NotificationTarget | "thread_creator" | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  purgeAfter?: string | null;
}

export interface FeatureRequestVote {
  id: string;
  featureRequestId: string;
  userId: string;
  vote: 1 | -1;
  createdAt: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
  purgeAfter?: string | null;
}

export interface UpdateLog {
  id: string;
  title: string;
  body: string;
  version: string | null;
  publishedAt: string;
  isPublished: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
  purgeAfter?: string | null;
}

export interface ComingSoonItem {
  id: string;
  title: string;
  description: string;
  status: "planned" | "in_progress" | "testing" | "delayed" | "released";
  targetDate: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
  purgeAfter?: string | null;
}

export interface Sop {
  id: string;
  title: string;
  body: string;
  category: string;
  roleVisibility: NotificationTarget;
  isPublished: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
  purgeAfter?: string | null;
}

export interface Notification {
  id: string;
  userId: string | null;
  roleTarget: NotificationTarget;
  type: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  createdAt: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
  purgeAfter?: string | null;
}

export interface GreenMachine {
  id: string;
  modelId: string | null;
  modelName: string;
  seriesFamily: string;
  serialNumber: string | null;
  locationId: string | null;
  status: GreenMachineStatus;
  notes: string;
  qrToken: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  archivedStatus: RestorableGreenMachineStatus | null;
  deletedAt?: string | null;
  purgeAfter?: string | null;
}

export interface GreenMachineEvent {
  id: string;
  machineId: string;
  eventType: GreenMachineEventType;
  partId: string | null;
  partName: string | null;
  partCategory: string | null;
  quantity: number | null;
  condition: string | null;
  note: string;
  createdBy: string;
  createdAt: string;
  batchId?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  purgeAfter?: string | null;
}

export interface FaqDraft {
  id?: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface ForumThreadDraft {
  id?: string;
  title: string;
  body: string;
  type: ForumThreadType;
  status: ForumThreadStatus;
  assignedTo?: string | null;
  isPinned?: boolean;
  isLocked?: boolean;
}

export interface ForumPostDraft {
  body: string;
  taggedTarget?: NotificationTarget | "thread_creator" | null;
}

export interface UpdateLogDraft {
  id?: string;
  title: string;
  body: string;
  version: string;
  publishedAt: string;
  isPublished: boolean;
}

export interface ComingSoonItemDraft {
  id?: string;
  title: string;
  description: string;
  status: ComingSoonItem["status"];
  targetDate: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface SopDraft {
  id?: string;
  title: string;
  body: string;
  category: string;
  roleVisibility: NotificationTarget;
  isPublished: boolean;
}

export interface GreenMachineDraft {
  id?: string;
  modelId: string | null;
  modelName: string;
  seriesFamily: string;
  serialNumber: string;
  locationId: string | null;
  status: GreenMachineStatus;
  notes: string;
}

export interface GreenMachineEventDraft {
  eventType: GreenMachineEventType;
  partId: string | null;
  partName: string;
  partCategory: string;
  quantity: string;
  condition: string;
  note: string;
  batchId?: string;
}

export interface WorkspaceContentState {
  faqs: Faq[];
  forumThreads: ForumThread[];
  forumPosts: ForumPost[];
  featureRequestVotes: FeatureRequestVote[];
  updateLogs: UpdateLog[];
  comingSoonItems: ComingSoonItem[];
  sops: Sop[];
  notifications: Notification[];
  greenMachines: GreenMachine[];
  greenMachineEvents: GreenMachineEvent[];
}
