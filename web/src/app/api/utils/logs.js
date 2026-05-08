import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function logActivity({
  actionType,
  entityType,
  entityId,
  displayName,
  details,
  beforeValue,
  afterValue,
}) {
  try {
    // Get current user session
    const session = await auth();
    const userId = session?.user?.id?.toString() || null;
    const userEmail = session?.user?.email || null;

    await sql`
      INSERT INTO inventory_logs (action_type, entity_type, entity_id, display_name, details, before_value, after_value, user_id, user_email)
      VALUES (${actionType}, ${entityType}, ${entityId}, ${displayName}, ${details}, ${JSON.stringify(beforeValue)}, ${JSON.stringify(afterValue)}, ${userId}, ${userEmail})
    `;
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}
