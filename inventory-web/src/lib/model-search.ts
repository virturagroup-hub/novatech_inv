import type { DeviceModel } from "./inventory-types";

export interface ModelSearchGroup {
  familyKey: string;
  manufacturer: string;
  series: string;
  label: string;
  directMatches: DeviceModel[];
  models: DeviceModel[];
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getModelDisplayName(model: Pick<DeviceModel, "manufacturer" | "name">) {
  return `${model.manufacturer} ${model.name}`.trim();
}

export function getModelSeriesLabel(model: Pick<DeviceModel, "series">) {
  return model.series?.trim() || "No series listed";
}

export function getModelFamilyKey(model: Pick<DeviceModel, "manufacturer" | "series" | "name">) {
  const series = normalizeSearch(model.series ?? "");
  const fallback = normalizeSearch(model.name ?? "");
  return `${normalizeSearch(model.manufacturer)}::${series || fallback}`;
}

export function getModelSearchBlob(
  model: Pick<DeviceModel, "manufacturer" | "name" | "series" | "status" | "notes">,
) {
  return normalizeSearch(
    [
      model.manufacturer,
      model.name,
      model.series,
      model.status,
      model.notes ?? "",
      getModelFamilyKey(model),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function sortModels(models: DeviceModel[]) {
  return [...models].sort((left, right) =>
    getModelDisplayName(left).localeCompare(getModelDisplayName(right)),
  );
}

export function groupModelsForSearch(
  models: DeviceModel[],
  query: string,
  options?: {
    manufacturer?: string;
    includeInactive?: boolean;
  },
) {
  const normalizedQuery = normalizeSearch(query);
  const filtered = models.filter((model) => {
    if (options?.manufacturer && model.manufacturer !== options.manufacturer) {
      return false;
    }

    if (options?.includeInactive === false && model.status !== "active") {
      return false;
    }

    return true;
  });

  const directMatches = normalizedQuery
    ? filtered.filter((model) => getModelSearchBlob(model).includes(normalizedQuery))
    : filtered;

  const matchedFamilies = new Set(directMatches.map((model) => getModelFamilyKey(model)));
  const grouped = new Map<string, ModelSearchGroup>();

  filtered.forEach((model) => {
    const familyKey = getModelFamilyKey(model);
    const shouldInclude = !normalizedQuery || matchedFamilies.has(familyKey);
    const directMatch = directMatches.some((item) => item.id === model.id);

    if (!shouldInclude && !directMatch) {
      return;
    }

    const group = grouped.get(familyKey) ?? {
      familyKey,
      manufacturer: model.manufacturer,
      series: model.series,
      label: getModelSeriesLabel(model),
      directMatches: [],
      models: [],
    };

    group.models.push(model);

    if (directMatch) {
      group.directMatches.push(model);
    }

    grouped.set(familyKey, group);
  });

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      models: sortModels(group.models),
      directMatches: sortModels(group.directMatches),
    }))
    .sort((left, right) => {
      const manufacturerCompare = left.manufacturer.localeCompare(right.manufacturer);
      if (manufacturerCompare !== 0) return manufacturerCompare;
      return left.label.localeCompare(right.label);
    });
}

export function getModelSearchReason(group: ModelSearchGroup) {
  if (group.directMatches.length === 0) {
    return "Series / family match";
  }

  const labels = group.directMatches.map(getModelDisplayName);
  return `Matched ${labels.slice(0, 2).join(", ")}${labels.length > 2 ? "…" : ""}`;
}

