import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { hash } from "argon2";

// Update user role or reset password (admin/elevated)
export async function PATCH(request, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or elevated
    const currentUserRows =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
    const currentUser = currentUserRows?.[0];
    if (!currentUser || !["admin", "elevated"].includes(currentUser.role)) {
      return Response.json(
        { error: "Forbidden: Admin or elevated access required" },
        { status: 403 },
      );
    }

    const { id } = params;
    const body = await request.json();

    // Handle password reset (admin and elevated can reset passwords)
    if (body.tempPassword !== undefined) {
      const hashedPassword = await hash(body.tempPassword);
      await sql`
        UPDATE auth_accounts 
        SET password = ${hashedPassword}
        WHERE "userId" = ${parseInt(id)} AND provider = 'credentials'
      `;
      await sql`
        UPDATE auth_users 
        SET must_change_password = TRUE, password_changed_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
      `;
      return Response.json({
        success: true,
        message: "Password reset successfully",
      });
    }

    // Handle role update (admin only)
    if (body.role) {
      if (currentUser.role !== "admin") {
        return Response.json(
          { error: "Only admins can modify user roles" },
          { status: 403 },
        );
      }

      if (!["technician", "elevated", "admin"].includes(body.role)) {
        return Response.json(
          { error: "Invalid role. Must be technician, elevated, or admin" },
          { status: 400 },
        );
      }

      const updated = await sql`
        UPDATE auth_users 
        SET role = ${body.role} 
        WHERE id = ${id} 
        RETURNING id, name, email, role
      `;

      if (updated.length === 0) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }

      return Response.json({ user: updated[0] });
    }

    return Response.json(
      { error: "No valid update provided" },
      { status: 400 },
    );
  } catch (err) {
    console.error("PATCH /api/admin/users/[id] error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const currentUserRows =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
    const currentUser = currentUserRows?.[0];
    if (!currentUser || currentUser.role !== "admin") {
      return Response.json(
        { error: "Only admins can delete users" },
        { status: 403 },
      );
    }

    const { id } = params;

    // Prevent self-deletion
    if (parseInt(id) === session.user.id) {
      return Response.json(
        { error: "Cannot delete your own account" },
        { status: 400 },
      );
    }

    // Delete user (CASCADE will delete auth_accounts and auth_sessions)
    await sql`DELETE FROM auth_users WHERE id = ${parseInt(id)}`;

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/admin/users/[id] error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
