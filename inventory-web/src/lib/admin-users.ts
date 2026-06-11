import type { User as SupabaseAuthUser } from "@supabase/supabase-js";

import { hasMustChangePasswordFlag } from "@/lib/supabase/auth-metadata";
import type { ProfileRow } from "@/lib/supabase/types";

export type AdminUserRecord = ProfileRow & {
  email: string;
  must_change_password: boolean;
  last_sign_in_at: string | null;
  auth_created_at: string | null;
  auth_email: string | null;
};

export function mergeAdminUsers(users: ProfileRow[], authUsers: SupabaseAuthUser[]): AdminUserRecord[] {
  const authById = new Map(authUsers.map((user) => [user.id, user]));

  return users.map((user) => {
    const authUser = authById.get(user.id);

    return {
      ...user,
      email: authUser?.email ?? "",
      must_change_password: hasMustChangePasswordFlag(authUser?.app_metadata),
      auth_created_at: authUser?.created_at ?? null,
      auth_email: authUser?.email ?? null,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
    };
  });
}
