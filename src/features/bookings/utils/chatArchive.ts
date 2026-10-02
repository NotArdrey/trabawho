import type { Json } from "@/integrations/supabase/database.types";

function metadataObject(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function userFlags(value: Json | undefined): string[] {
  if (Array.isArray(value)) return value.map(String);
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

export function isArchivedForUser(metadata: Json | null, userId: string): boolean {
  const flags = metadataObject(metadata);
  const containsUser = (keys: string[]) => keys.some((key) => userFlags(flags[key]).includes(userId));
  return containsUser(["archived_by", "archivedBy"]) && !containsUser(["deleted_by", "deletedBy"]);
}

export function removeArchiveForUser(metadata: Json | null, userId: string): Json {
  const flags = { ...metadataObject(metadata) };
  for (const key of ["archived_by", "archivedBy"]) {
    if (key in flags) flags[key] = userFlags(flags[key]).filter((id) => id !== userId);
  }
  for (const key of ["archived_at_by", "archivedAtBy"]) {
    if (key in flags) {
      const timestamps = { ...metadataObject(flags[key] ?? null) };
      delete timestamps[userId];
      flags[key] = timestamps;
    }
  }
  return flags;
}
