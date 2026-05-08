import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { hash } from "argon2";

// Create new user (admin and elevated only)
export async function POST(request) {
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

    const body = await request.json();
    const { name, email, tempPassword, role = "technician" } = body;

    if (!name || !email || !tempPassword) {
      return Response.json(
        { error: "Name, email, and temporary password are required" },
        { status: 400 },
      );
    }

    // Validate role permissions
    const validRoles = ["technician", "elevated", "admin"];
    if (!validRoles.includes(role)) {
      return Response.json(
        { error: "Invalid role specified" },
        { status: 400 },
      );
    }

    // Elevated users can only create technician users
    if (currentUser.role === "elevated" && role !== "technician") {
      return Response.json(
        { error: "Elevated users can only create technician accounts" },
        { status: 403 },
      );
    }

    // Check if user already exists
    const existingUser =
      await sql`SELECT id FROM auth_users WHERE email = ${email} LIMIT 1`;
    if (existingUser.length > 0) {
      return Response.json(
        { error: "User with this email already exists" },
        { status: 400 },
      );
    }

    // Create user with must_change_password flag
    const newUserRows = await sql`
      INSERT INTO auth_users (name, email, "emailVerified", role, must_change_password)
      VALUES (${name}, ${email}, NULL, ${role}, true)
      RETURNING id, name, email, role
    `;
    const newUser = newUserRows[0];

    // Hash the temporary password and create account
    const hashedPassword = await hash(tempPassword);
    await sql`
      INSERT INTO auth_accounts ("userId", provider, type, "providerAccountId", password)
      VALUES (${newUser.id}, 'credentials', 'credentials', ${newUser.id}, ${hashedPassword})
    `;

    return Response.json({
      user: newUser,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} user created successfully`,
    });
  } catch (err) {
    console.error("POST /api/admin/users/create error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
