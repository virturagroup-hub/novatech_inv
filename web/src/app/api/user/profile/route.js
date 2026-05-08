import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const rows =
      await sql`SELECT id, name, email, image, role, must_change_password, password_changed_at, 
                EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(password_changed_at, created_at))) as password_age_days
                FROM auth_users WHERE id = ${userId} LIMIT 1`;
    const user = rows?.[0] || null;
    return Response.json({ user });
  } catch (err) {
    console.error("GET /api/user/profile error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
