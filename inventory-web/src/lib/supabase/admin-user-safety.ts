import type { SupabaseClient } from "@supabase/supabase-js";

export async function getActiveAdminCount(
  supabase: SupabaseClient,
  excludeUserId?: string,
) {
  let query = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("active", true);

  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
