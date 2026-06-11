import type { ProfileRow } from "@/lib/supabase/types";

export function profileDisplayName(profile: Pick<ProfileRow, "full_name">, fallbackEmail = "") {
  return profile.full_name?.trim() || fallbackEmail || "Unknown user";
}
