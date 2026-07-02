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
} from "./workspace-content-types";

export const workspaceContentStorageKey = "novatech-workspace-content-v1";

export const seedFaqs: Faq[] = [
  {
    id: "faq-labels",
    question: "How do I print part labels?",
    answer:
      "Open Reports / Exports or the label builder, select your parts, choose sheet or thermal mode, then print the previewed labels.",
    category: "Labels",
    sortOrder: 1,
    isPublished: true,
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
    createdAt: "2026-06-20T14:00:00.000Z",
    updatedAt: "2026-06-20T14:00:00.000Z",
  },
  {
    id: "faq-support",
    question: "Who can create support requests?",
    answer:
      "Everyone who is signed in, including viewers, can create support and feature requests. Admins and managers can moderate and respond.",
    category: "Support",
    sortOrder: 2,
    isPublished: true,
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
    createdAt: "2026-06-20T14:15:00.000Z",
    updatedAt: "2026-06-20T14:15:00.000Z",
  },
  {
    id: "faq-machines",
    question: "What is a machine record?",
    answer:
      "A machine record tracks a broken or stripped machine that still has useful parts. Technicians can scan the QR label, log parts taken, and move reusable parts back into inventory.",
    category: "Machines",
    sortOrder: 3,
    isPublished: true,
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
    createdAt: "2026-06-20T14:30:00.000Z",
    updatedAt: "2026-06-20T14:30:00.000Z",
  },
  {
    id: "faq-login",
    question: "Why do I get sent back to login after scanning a QR label?",
    answer:
      "The QR code opens the protected part or machine record. If you are not signed in, the app sends you to login and then returns you to the scanned page.",
    category: "Login",
    sortOrder: 4,
    isPublished: true,
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
    createdAt: "2026-06-20T14:45:00.000Z",
    updatedAt: "2026-06-20T14:45:00.000Z",
  },
];

export const seedForumThreads: ForumThread[] = [
  {
    id: "thread-support-c5840",
    title: "imageRUNNER C5840 missing a fuser sleeve",
    body:
      "We opened a stripped unit this morning and the fuser sleeve is not on the shelf. Looking for the best place to note this and notify the team.",
    type: "support",
    status: "open",
    createdBy: "seed-tech",
    assignedTo: "seed-admin",
    isPinned: false,
    isLocked: false,
    createdAt: "2026-06-21T10:20:00.000Z",
    updatedAt: "2026-06-21T10:20:00.000Z",
  },
  {
    id: "thread-feature-single-labels",
    title: "Add a thermal label mode for single parts",
    body:
      "The sheet layout works well for staging, but it would help to print one label at a time for label printers at the counter or in the shop.",
    type: "feature_request",
    status: "under_review",
    createdBy: "seed-viewer",
    assignedTo: "seed-admin",
    isPinned: true,
    isLocked: false,
    createdAt: "2026-06-22T08:10:00.000Z",
    updatedAt: "2026-06-25T12:00:00.000Z",
  },
  {
    id: "thread-general-green-machines",
    title: "Best notes format for stripped machines",
    body:
      "Share the note style that makes it easiest to see what has already been removed from a machine before anyone starts teardown.",
    type: "general",
    status: "open",
    createdBy: "seed-tech",
    assignedTo: null,
    isPinned: false,
    isLocked: false,
    createdAt: "2026-06-23T13:00:00.000Z",
    updatedAt: "2026-06-23T13:30:00.000Z",
  },
];

export const seedForumPosts: ForumPost[] = [
  {
    id: "post-support-answer",
    threadId: "thread-support-c5840",
    body:
      "Add the event on the machine record, then create the replacement part request from the machine page so the team can see both records together.",
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
    createdAt: "2026-06-21T10:45:00.000Z",
    updatedAt: "2026-06-21T10:45:00.000Z",
    taggedTarget: "admin",
  },
  {
    id: "post-feature-upvote",
    threadId: "thread-feature-single-labels",
    body:
      "Thermal mode will also make the QR labels easier to read on the little printers by the parts counter.",
    createdBy: "seed-tech",
    updatedBy: "seed-tech",
    createdAt: "2026-06-22T08:45:00.000Z",
    updatedAt: "2026-06-22T08:45:00.000Z",
    taggedTarget: "thread_creator",
  },
  {
    id: "post-general-tip",
    threadId: "thread-general-green-machines",
    body:
      "We have been keeping the machine notes short: part removed, part transferred, and one line of condition notes per event works well on mobile.",
    createdBy: "seed-viewer",
    updatedBy: "seed-viewer",
    createdAt: "2026-06-23T13:20:00.000Z",
    updatedAt: "2026-06-23T13:20:00.000Z",
  },
];

export const seedFeatureVotes: FeatureRequestVote[] = [
  {
    id: "vote-single-label-up",
    featureRequestId: "thread-feature-single-labels",
    userId: "seed-tech",
    vote: 1,
    createdAt: "2026-06-22T08:45:00.000Z",
  },
  {
    id: "vote-single-label-up-2",
    featureRequestId: "thread-feature-single-labels",
    userId: "seed-viewer",
    vote: 1,
    createdAt: "2026-06-22T09:00:00.000Z",
  },
];

export const seedUpdateLogs: UpdateLog[] = [
  {
    id: "update-log-single-labels",
    title: "Preview support for thermal labels",
    body:
      "We are adding a dedicated single-label layout so the browser print preview can feed narrow label printers without wasting a full sheet.",
    version: "0.2.0",
    publishedAt: "2026-06-25T15:00:00.000Z",
    isPublished: true,
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
  },
  {
    id: "update-log-green-machines",
    title: "Machines workflow started",
    body:
      "A new machine record flow is being added for stripped units, technician notes, and parts pulled back into inventory.",
    version: "0.2.1",
    publishedAt: "2026-06-28T12:00:00.000Z",
    isPublished: true,
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
  },
];

export const seedComingSoonItems: ComingSoonItem[] = [
  {
    id: "coming-soon-notifications",
    title: "Notifications center",
    description:
      "One place to review support replies, forum activity, feature request changes, and admin mentions.",
    status: "in_progress",
    targetDate: "2026-07-10",
    sortOrder: 1,
    isPublished: true,
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
    createdAt: "2026-06-24T09:00:00.000Z",
    updatedAt: "2026-06-24T09:00:00.000Z",
  },
  {
    id: "coming-soon-machine-transfer",
    title: "Machine-to-inventory transfer flow",
    description:
      "Turn machine pulls into reusable parts with a direct transfer workflow instead of a second manual entry.",
    status: "planned",
    targetDate: "2026-07-18",
    sortOrder: 2,
    isPublished: true,
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
    createdAt: "2026-06-24T09:15:00.000Z",
    updatedAt: "2026-06-24T09:15:00.000Z",
  },
  {
    id: "coming-soon-mobile-scan",
    title: "Better mobile scan notes",
    description:
      "A faster mobile note flow for technicians who are recording what has already been removed from a machine.",
    status: "testing",
    targetDate: "2026-07-22",
    sortOrder: 3,
    isPublished: true,
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
    createdAt: "2026-06-24T09:30:00.000Z",
    updatedAt: "2026-06-24T09:30:00.000Z",
  },
];

export const seedSops: Sop[] = [
  {
    id: "sop-green-machines",
    title: "Machine teardown checklist",
    body:
      "1. Scan the machine QR label.\n2. Review the notes and event timeline.\n3. Add a taken event before removing any part.\n4. Transfer reusable parts into inventory.\n5. Leave a final note when the machine is empty or scrapped.",
    category: "Operations",
    roleVisibility: "all",
    isPublished: true,
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
    createdAt: "2026-06-20T16:00:00.000Z",
    updatedAt: "2026-06-20T16:00:00.000Z",
  },
  {
    id: "sop-support-triage",
    title: "Support request triage",
    body:
      "Support requests should be acknowledged quickly, tagged to the right role, and moved to planned or in-progress once a fix is scheduled.",
    category: "Support",
    roleVisibility: "manager",
    isPublished: true,
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
    createdAt: "2026-06-20T16:15:00.000Z",
    updatedAt: "2026-06-20T16:15:00.000Z",
  },
];

export const seedNotifications: Notification[] = [
  {
    id: "notification-support-admin",
    userId: null,
    roleTarget: "admin",
    type: "support_request",
    title: "New support request",
    body: "A new support request was opened for the C5840 fuser sleeve.",
    entityType: "forum_thread",
    entityId: "thread-support-c5840",
    isRead: false,
    createdAt: "2026-06-21T10:20:00.000Z",
  },
  {
    id: "notification-feature-admin",
    userId: null,
    roleTarget: "admin",
    type: "feature_request",
    title: "Feature request needs review",
    body: "The thermal single-label request has been upvoted and is ready for a status update.",
    entityType: "forum_thread",
    entityId: "thread-feature-single-labels",
    isRead: false,
    createdAt: "2026-06-22T08:45:00.000Z",
  },
  {
    id: "notification-update-all",
    userId: null,
    roleTarget: "all",
    type: "update_log",
    title: "New update log published",
    body: "Preview support for thermal labels is now documented in the update log.",
    entityType: "update_log",
    entityId: "update-log-single-labels",
    isRead: false,
    createdAt: "2026-06-25T15:00:00.000Z",
  },
];

export const seedGreenMachines: GreenMachine[] = [
  {
    id: "machine-c5840-shell",
    modelId: "canon-c5840",
    modelName: "imageRUNNER ADVANCE DX C5840",
    seriesFamily: "C5800",
    serialNumber: "C5840-88210",
    locationId: "bin-review",
    status: "partially_stripped",
    notes:
      "Broken power supply already removed. Imaging unit and transfer components are still inside.",
    qrToken: "machine-c5840-shell",
    createdBy: "seed-admin",
    updatedBy: "seed-tech",
    createdAt: "2026-06-18T09:00:00.000Z",
    updatedAt: "2026-06-28T11:15:00.000Z",
    archivedAt: null,
    archivedStatus: null,
  },
  {
    id: "machine-hp-m607-core",
    modelId: "hp-m607",
    modelName: "LaserJet Enterprise M607",
    seriesFamily: "M600",
    serialNumber: "M607-42219",
    locationId: "bin-overflow",
    status: "active",
    notes:
      "Waiting on teardown. Feeder assemblies and fans are still expected to be usable.",
    qrToken: "machine-hp-m607-core",
    createdBy: "seed-admin",
    updatedBy: "seed-admin",
    createdAt: "2026-06-19T08:30:00.000Z",
    updatedAt: "2026-06-29T13:00:00.000Z",
    archivedAt: null,
    archivedStatus: null,
  },
];

export const seedGreenMachineEvents: GreenMachineEvent[] = [
  {
    id: "machine-event-c5840-note",
    machineId: "machine-c5840-shell",
    eventType: "taken",
    partId: null,
    partName: "Power supply",
    quantity: 1,
    condition: "Burn marks on board",
    note: "Power supply removed and set aside for inspection.",
    createdBy: "seed-tech",
    createdAt: "2026-06-28T10:10:00.000Z",
  },
  {
    id: "machine-event-c5840-transfer",
    machineId: "machine-c5840-shell",
    eventType: "transferred_to_inventory",
    partId: "part-fm1-d581",
    partName: "Fixing Assembly",
    quantity: 1,
    condition: "Tested good",
    note: "Transferred a matching fixing assembly back into the normal parts inventory.",
    createdBy: "seed-tech",
    createdAt: "2026-06-28T10:25:00.000Z",
  },
  {
    id: "machine-event-hp-m607-note",
    machineId: "machine-hp-m607-core",
    eventType: "note",
    partId: null,
    partName: null,
    quantity: null,
    condition: null,
    note: "Scanner cable and tray assembly still need a quick check before the next teardown.",
    createdBy: "seed-admin",
    createdAt: "2026-06-29T13:15:00.000Z",
  },
];

export function createDefaultWorkspaceContentState(): WorkspaceContentState {
  return {
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
}

export function createSeedWorkspaceContentState(): WorkspaceContentState {
  return {
    faqs: structuredClone(seedFaqs),
    forumThreads: structuredClone(seedForumThreads),
    forumPosts: structuredClone(seedForumPosts),
    featureRequestVotes: structuredClone(seedFeatureVotes),
    updateLogs: structuredClone(seedUpdateLogs),
    comingSoonItems: structuredClone(seedComingSoonItems),
    sops: structuredClone(seedSops),
    notifications: structuredClone(seedNotifications),
    greenMachines: structuredClone(seedGreenMachines),
    greenMachineEvents: structuredClone(seedGreenMachineEvents),
  };
}
