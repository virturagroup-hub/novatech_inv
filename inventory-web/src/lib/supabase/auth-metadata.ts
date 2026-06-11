type MetadataRecord = Record<string, unknown>;

function toMetadataRecord(value: unknown): MetadataRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as MetadataRecord;
}

export function mergeAppMetadata(existing: unknown, patch: MetadataRecord): MetadataRecord {
  return {
    ...toMetadataRecord(existing),
    ...patch,
  };
}

export function hasMustChangePasswordFlag(metadata: unknown) {
  return Boolean(toMetadataRecord(metadata).must_change_password);
}
