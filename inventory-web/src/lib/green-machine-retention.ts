import type { GreenMachine, GreenMachineEvent, WorkspaceContentState } from "@/lib/workspace-content-types";

export const GREEN_MACHINE_ARCHIVE_RETENTION_DAYS = 30;
export const GREEN_MACHINE_ARCHIVE_RETENTION_MS =
  GREEN_MACHINE_ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseTimestamp(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getGreenMachineArchiveExpiresAt(machine: Pick<GreenMachine, "archivedAt">) {
  const archivedAt = parseTimestamp(machine.archivedAt);
  if (archivedAt === null) {
    return null;
  }

  return new Date(archivedAt + GREEN_MACHINE_ARCHIVE_RETENTION_MS);
}

export function getGreenMachineArchiveDaysRemaining(
  machine: Pick<GreenMachine, "archivedAt">,
  now = Date.now(),
) {
  const expiresAt = getGreenMachineArchiveExpiresAt(machine);
  if (!expiresAt) {
    return null;
  }

  return Math.max(0, Math.ceil((expiresAt.getTime() - now) / DAY_MS));
}

export function getGreenMachineArchiveRetentionLabel(
  machine: Pick<GreenMachine, "archivedAt">,
  now = Date.now(),
) {
  const daysRemaining = getGreenMachineArchiveDaysRemaining(machine, now);

  if (daysRemaining === null) {
    return null;
  }

  if (daysRemaining === 0) {
    return "Purges today";
  }

  return `Restorable for ${daysRemaining} more day${daysRemaining === 1 ? "" : "s"}`;
}

export function getGreenMachineRestoreStatus(
  machine: Pick<GreenMachine, "archivedStatus">,
) {
  return machine.archivedStatus ?? "active";
}

export function shouldPurgeGreenMachine(
  machine: Pick<GreenMachine, "status" | "archivedAt">,
  now = Date.now(),
) {
  if (machine.status !== "archived") {
    return false;
  }

  const archivedAt = parseTimestamp(machine.archivedAt);
  if (archivedAt === null) {
    return false;
  }

  return now >= archivedAt + GREEN_MACHINE_ARCHIVE_RETENTION_MS;
}

export function purgeExpiredGreenMachines(state: WorkspaceContentState, now = Date.now()) {
  let stateChanged = false;
  const normalizedMachines = state.greenMachines.map((machine) => {
    if (machine.status !== "archived") {
      return machine;
    }

    if (machine.archivedAt && machine.archivedStatus) {
      return machine;
    }

    stateChanged = true;
    return {
      ...machine,
      archivedAt: machine.archivedAt ?? new Date(now).toISOString(),
      archivedStatus: machine.archivedStatus ?? "active",
    };
  });

  const expiredMachineIds = new Set(
    normalizedMachines.filter((machine) => shouldPurgeGreenMachine(machine, now)).map((machine) => machine.id),
  );

  if (expiredMachineIds.size === 0 && !stateChanged) {
    return state;
  }

  return {
    ...state,
    greenMachines: normalizedMachines.filter((machine) => !expiredMachineIds.has(machine.id)),
    greenMachineEvents: state.greenMachineEvents.filter(
      (event: GreenMachineEvent) => !expiredMachineIds.has(event.machineId),
    ),
  };
}
