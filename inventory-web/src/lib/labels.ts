export type LabelMode = "each" | "copies" | "quantity";

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

export function buildPartPrintHref(options: {
  partIds: string[];
  labelMode?: LabelMode;
  copies?: number;
  includeZero?: boolean;
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

  const query = params.toString();
  return query ? `/print?${query}` : "/print";
}

export function buildBinPrintHref(options: { binId: string; copies?: number }) {
  const params = new URLSearchParams();
  params.set("binId", options.binId);
  params.set("copies", String(normalizePrintCopies(options.copies ?? 1)));
  const query = params.toString();
  return query ? `/print?${query}` : "/print";
}
