import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Get all users (admin and elevated only)
export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or elevated
    const currentUserRows =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
    const currentUser = currentUserRows?.[0];
    if (
      !currentUser ||
      (currentUser.role !== "admin" && currentUser.role !== "elevated")
    ) {
      return Response.json(
        { error: "Forbidden: Admin or elevated access required" },
        { status: 403 },
      );
    }

    // Get all users
    const users = await sql`
      SELECT id, name, email, role, "emailVerified", image, created_at 
      FROM auth_users 
      ORDER BY created_at DESC
    `;

    return Response.json({ users });
  } catch (err) {
    console.error("GET /api/admin/users error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
