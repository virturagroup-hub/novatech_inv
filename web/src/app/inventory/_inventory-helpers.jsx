// Helper functions for inventory page

export function checkDuplicatePart(
  partNumber,
  existingParts,
  currentPartId = null,
) {
  const duplicate = existingParts.find(
    (p) =>
      p.part_number.toLowerCase() === partNumber.toLowerCase() &&
      p.id !== currentPartId,
  );
  return duplicate;
}

export function getUniqueManufacturers(models) {
  return [...new Set(models.map((m) => m.manufacturer).filter(Boolean))].sort();
}

export function sortModelsByManufacturer(models) {
  return [...models].sort((a, b) => {
    const mfrA = a.manufacturer || "ZZZZ"; // Put unknowns last
    const mfrB = b.manufacturer || "ZZZZ";
    if (mfrA !== mfrB) return mfrA.localeCompare(mfrB);
    return a.name.localeCompare(b.name);
  });
}
