import sql from "@/app/api/utils/sql";
import { logActivity } from "@/app/api/utils/logs";

export async function PATCH(request, { params }) {
  const { id } = params;
  const body = await request.json();

  const [before] = await sql`SELECT * FROM bins WHERE id = ${id}`;
  if (!before) return new Response("Not found", { status: 404 });

  const fields = [
    "name",
    "description",
    "grid_row",
    "grid_col",
    "manufacturer",
  ];
  const updates = [];
  const values = [];
  let count = 1;

  fields.forEach((field) => {
    if (body[field] !== undefined) {
      updates.push(`${field} = $${count}`);
      values.push(body[field]);
      count++;
    }
  });

  if (updates.length === 0) return Response.json(before);

  const query = `UPDATE bins SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${count} RETURNING *`;
  values.push(id);

  const [after] = await sql(query, values);

  await logActivity({
    actionType: "edited",
    entityType: "bin",
    entityId: id,
    displayName: after.name,
    beforeValue: before,
    afterValue: after,
  });

  return Response.json(after);
}

export async function DELETE(request, { params }) {
  const { id } = params;
  const [before] = await sql`SELECT * FROM bins WHERE id = ${id}`;

  if (!before) {
    return Response.json({ error: "Bin not found" }, { status: 404 });
  }

  // Check if any parts are assigned to this bin
  const partsCount =
    await sql`SELECT COUNT(*) as count FROM parts WHERE bin_id = ${id}`;

  if (partsCount[0].count > 0) {
    return Response.json(
      {
        error: `Cannot delete bin. ${partsCount[0].count} part(s) are assigned to this bin.`,
      },
      { status: 400 },
    );
  }

  // Requirement: If a bin is deleted, clearly mark parts as unassigned (handled by SET NULL in schema)
  await sql`DELETE FROM bins WHERE id = ${id}`;

  await logActivity({
    actionType: "removed",
    entityType: "bin",
    entityId: id,
    displayName: before.name,
    beforeValue: before,
  });

  return new Response(null, { status: 204 });
}
