import sql from "@/app/api/utils/sql";
import { logActivity } from "@/app/api/utils/logs";

export async function GET() {
  const bins = await sql`SELECT * FROM bins ORDER BY name ASC`;

  // For each bin, get parts count
  const binsWithData = await Promise.all(
    bins.map(async (bin) => {
      const parts = await sql`
        SELECT id
        FROM parts
        WHERE bin_id = ${bin.id}
      `;

      return {
        ...bin,
        partsCount: parts.length,
      };
    }),
  );

  return Response.json(binsWithData);
}

export async function POST(request) {
  const { name, description, grid_row, grid_col, manufacturer } =
    await request.json();

  const [bin] = await sql`
    INSERT INTO bins (name, description, grid_row, grid_col, manufacturer) 
    VALUES (${name}, ${description || null}, ${grid_row || null}, ${grid_col || null}, ${manufacturer || null}) 
    RETURNING *
  `;

  await logActivity({
    actionType: "added",
    entityType: "bin",
    entityId: bin.id,
    displayName: bin.name,
    afterValue: bin,
  });

  return Response.json(bin);
}
