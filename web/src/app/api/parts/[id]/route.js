import sql from "@/app/api/utils/sql";
import { logActivity } from "@/app/api/utils/logs";

export async function GET(request, { params }) {
  const { id } = params;

  const [part] = await sql`
    SELECT 
      parts.*,
      bins.name as bin_name
    FROM parts
    LEFT JOIN bins ON parts.bin_id = bins.id
    WHERE parts.id = ${id}
  `;

  if (!part) {
    return new Response(JSON.stringify({ error: "Part not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({ part });
}

export async function PATCH(request, { params }) {
  const { id } = params;
  const body = await request.json();

  const [before] = await sql`SELECT * FROM parts WHERE id = ${id}`;
  if (!before) return new Response("Not found", { status: 404 });

  const fields = [
    "part_number",
    "part_name",
    "compatible_models",
    // in_date is now persistent - don't allow editing after creation
    "bin_id",
    "quantity",
    "notes",
    "is_universal",
  ];
  const updates = [];
  const values = [];
  let count = 1;

  fields.forEach((field) => {
    if (body[field] !== undefined) {
      if (field === "compatible_models") {
        updates.push(`${field} = $${count}`);
        values.push(JSON.stringify(body[field] || []));
      } else if (field === "bin_id") {
        // Handle empty string as null for bin_id
        const binValue =
          body[field] && body[field] !== "" ? parseInt(body[field]) : null;
        updates.push(`${field} = $${count}`);
        values.push(binValue);
      } else if (field === "quantity") {
        updates.push(`${field} = $${count}`);
        values.push(
          body[field] !== null && body[field] !== undefined
            ? parseInt(body[field])
            : 0,
        );
      } else if (field === "is_universal") {
        updates.push(`${field} = $${count}`);
        values.push(body[field] || false);
      } else {
        updates.push(`${field} = $${count}`);
        values.push(body[field]);
      }
      count++;
    }
  });

  // Re-check flagging: flag if no compatible models AND not marked as universal
  if (body.compatible_models !== undefined || body.is_universal !== undefined) {
    const isUniversal =
      body.is_universal !== undefined ? body.is_universal : before.is_universal;
    const compatibleModels =
      body.compatible_models !== undefined
        ? body.compatible_models
        : before.compatible_models;
    const flagged =
      !isUniversal && (!compatibleModels || compatibleModels.length === 0);
    updates.push(`flagged = $${count}`);
    values.push(flagged);
    count++;
  }

  if (updates.length === 0) return Response.json(before);

  const query = `UPDATE parts SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${count} RETURNING *`;
  values.push(id);

  const [after] = await sql(query, values);

  // Build details for quantity changes
  let details = undefined;
  if (body.quantity !== undefined && before.quantity !== after.quantity) {
    const delta = after.quantity - before.quantity;
    if (delta > 0) {
      details = `Added ${delta} unit(s) - now ${after.quantity} in stock`;
    } else if (delta < 0) {
      details = `Removed ${Math.abs(delta)} unit(s) - now ${after.quantity} in stock`;
    }
  }

  await logActivity({
    actionType: "edited",
    entityType: "part",
    entityId: id,
    displayName: `${after.part_number} - ${after.part_name}`,
    details,
    beforeValue: before,
    afterValue: after,
  });

  return Response.json(after);
}

export async function DELETE(request, { params }) {
  const { id } = params;
  const [before] = await sql`SELECT * FROM parts WHERE id = ${id}`;
  if (!before) return new Response("Not found", { status: 404 });

  await sql`DELETE FROM parts WHERE id = ${id}`;

  await logActivity({
    actionType: "removed",
    entityType: "part",
    entityId: id,
    displayName: `${before.part_number} - ${before.part_name}`,
    beforeValue: before,
  });

  return new Response(null, { status: 204 });
}
