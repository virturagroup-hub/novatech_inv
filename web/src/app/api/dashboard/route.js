import sql from "@/app/api/utils/sql";

export async function GET() {
  const [stats] = await sql`
    SELECT 
      (SELECT COALESCE(SUM(quantity), 0) FROM parts) as total_parts,
      (SELECT COUNT(DISTINCT part_number) FROM parts) as unique_part_numbers,
      (SELECT COUNT(*) FROM bins) as total_bins,
      (SELECT COUNT(*) FROM parts WHERE flagged = TRUE) as flagged_parts
  `;

  const recentLogs = await sql`
    SELECT * FROM inventory_logs 
    ORDER BY timestamp DESC 
    LIMIT 10
  `;

  const flaggedList = await sql`
    SELECT p.*, b.name as bin_name 
    FROM parts p 
    LEFT JOIN bins b ON p.bin_id = b.id
    WHERE p.flagged = TRUE
    ORDER BY p.updated_at DESC
    LIMIT 5
  `;

  return Response.json({ stats, recentLogs, flaggedList });
}
