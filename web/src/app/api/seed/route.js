import sql from "@/app/api/utils/sql";

export async function POST() {
  try {
    // Seed Bins
    await sql`INSERT INTO bins (name, description) VALUES 
      ('Shelf A-1', 'Main entry shelf for high-turnover parts'),
      ('Bin B-202', 'Storage for rollers and small mechanical parts'),
      ('Drawer C-3', 'Fuser assembly storage')
    ON CONFLICT DO NOTHING`;

    // Seed Models
    await sql`INSERT INTO models (name) VALUES 
      ('Canon ImageRunner Adv C3945'),
      ('Canon ImageRunner Adv C5030'),
      ('Canon imageForce C5145'),
      ('HP LaserJet Managed E60165')
    ON CONFLICT (name) DO NOTHING`;

    // Seed Parts
    const [bin] = await sql`SELECT id FROM bins LIMIT 1`;
    await sql`INSERT INTO parts (part_number, part_name, compatible_models, bin_id, quantity, notes, flagged) VALUES 
      ('FM1-D581', 'Fixing Assembly', '["Canon ImageRunner Adv C3945", "Canon ImageRunner Adv C5030"]', ${bin.id}, 5, 'Critical part for fuser repairs', FALSE),
      ('FC0-5080', 'Pickup Roller', '["Canon ImageRunner Adv C5030"]', ${bin.id}, 50, 'Regular maintenance item', FALSE),
      ('UNKNOWN-1', 'Generic Sensor', '[]', NULL, 2, 'Found on floor, needs identification', TRUE)
    `;

    return Response.json({ message: "Seeded successfully" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
