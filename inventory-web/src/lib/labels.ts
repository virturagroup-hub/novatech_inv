export type LabelMode = "each" | "copies" | "quantity";
export type LabelLayout = "sheet" | "thermal";

export const LABELS_PER_SHEET = 8;
export const MAX_PRINT_COPIES = 12;

export function normalizePrintCopies(
  value: string | number | null | undefined,
  fallback = 1,
) {
  const numericValue =
    typeof value === "number" ? value : Number(value ?? fallback);

  if (!Number.isFinite(numericValue)) {
    return Math.max(1, Math.min(MAX_PRINT_COPIES, fallback));
  }

  return Math.max(1, Math.min(MAX_PRINT_COPIES, Math.round(numericValue)));
}

export function parseIdList(value: string | null | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function encodeCopiesByPart(copiesByPart: Record<string, number>) {
  return Object.entries(copiesByPart)
    .filter(([, copies]) => Number.isFinite(copies) && copies > 0)
    .map(([partId, copies]) => `${encodeURIComponent(partId)}:${normalizePrintCopies(copies)}`)
    .join(",");
}

export function parseCopiesByPart(value: string | null | undefined) {
  if (!value) {
    return {} as Record<string, number>;
  }

  return value.split(",").reduce<Record<string, number>>((accumulator, entry) => {
    const [rawPartId, rawCopies] = entry.split(":");
    if (!rawPartId || !rawCopies) {
      return accumulator;
    }

    const partId = decodeURIComponent(rawPartId.trim());
    const copies = normalizePrintCopies(rawCopies, 1);
    if (partId && copies > 0) {
      accumulator[partId] = copies;
    }

    return accumulator;
  }, {});
}

export function buildPartPrintHref(options: {
  partIds: string[];
  labelMode?: LabelMode;
  copies?: number;
  includeZero?: boolean;
  copiesByPart?: Record<string, number>;
  layout?: LabelLayout;
}) {
  const params = new URLSearchParams();

  if (options.partIds.length > 0) {
    params.set("partIds", options.partIds.join(","));
  }

  if (options.labelMode && options.labelMode !== "each") {
    params.set("labelMode", options.labelMode);
  }

  if (options.labelMode === "copies" || options.labelMode === "quantity") {
    params.set("copies", String(normalizePrintCopies(options.copies ?? 1)));
  }

  if (options.includeZero) {
    params.set("includeZero", "1");
  }

  if (options.copiesByPart && Object.keys(options.copiesByPart).length > 0) {
    params.set("copiesByPart", encodeCopiesByPart(options.copiesByPart));
  }

  if (options.layout && options.layout !== "sheet") {
    params.set("layout", options.layout);
  }

  const query = params.toString();
  return query ? `/print?${query}` : "/print";
}

export function buildBinPrintHref(options: { binId: string; copies?: number; layout?: LabelLayout }) {
  const params = new URLSearchParams();
  params.set("binId", options.binId);
  params.set("copies", String(normalizePrintCopies(options.copies ?? 1)));
  if (options.layout && options.layout !== "sheet") {
    params.set("layout", options.layout);
  }
  const query = params.toString();
  return query ? `/print?${query}` : "/print";
}

export function buildMachinePrintHref(options: { machineId: string; layout?: LabelLayout }) {
  const params = new URLSearchParams();
  params.set("machineId", options.machineId);

  if (options.layout && options.layout !== "sheet") {
    params.set("layout", options.layout);
  }

  const query = params.toString();
  return query ? `/print?${query}` : "/print";
}
