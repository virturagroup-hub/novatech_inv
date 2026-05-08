import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { hash, verify } from "argon2";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return Response.json(
        { error: "Current password and new password are required" },
        { status: 400 },
      );
    }

    // Validate password requirements
    if (newPassword.length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }
    if (!/[A-Z]/.test(newPassword)) {
      return Response.json(
        { error: "Password must contain at least one uppercase letter" },
        { status: 400 },
      );
    }
    if (!/[a-z]/.test(newPassword)) {
      return Response.json(
        { error: "Password must contain at least one lowercase letter" },
        { status: 400 },
      );
    }
    if (!/[0-9]/.test(newPassword)) {
      return Response.json(
        { error: "Password must contain at least one number" },
        { status: 400 },
      );
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return Response.json(
        { error: "Password must contain at least one special character" },
        { status: 400 },
      );
    }

    const userId = session.user.id;

    // Get current password hash
    const accountRows = await sql`
      SELECT password FROM auth_accounts 
      WHERE "userId" = ${userId} AND provider = 'credentials'
      LIMIT 1
    `;

    if (!accountRows || accountRows.length === 0) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    const currentHash = accountRows[0].password;

    // Verify current password
    const isValid = await verify(currentHash, currentPassword);
    if (!isValid) {
      return Response.json(
        { error: "Current password is incorrect" },
        { status: 401 },
      );
    }

    // Hash the new password
    const hashedPassword = await hash(newPassword);

    // Update the password in auth_accounts
    await sql`
      UPDATE auth_accounts 
      SET password = ${hashedPassword} 
      WHERE "userId" = ${userId} AND provider = 'credentials'
    `;

    // Clear the must_change_password flag and update password_changed_at
    await sql`
      UPDATE auth_users 
      SET must_change_password = false, password_changed_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `;

    return Response.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("POST /api/user/change-password error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
