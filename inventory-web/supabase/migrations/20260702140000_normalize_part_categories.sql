-- Normalize legacy part categories into the canonical technician-facing list.
-- Category labels are stored directly on parts, so there is no separate category table
-- to archive. This backfill updates existing rows in place and keeps future writes clean.

with normalized_parts as (
  select
    id,
    case
      when category is null or btrim(category) = '' then 'Miscellaneous'
      else case lower(regexp_replace(btrim(category), '[^a-z0-9]+', ' ', 'g'))
        when 'accessory' then 'Accessories'
        when 'accessories' then 'Accessories'
        when 'board' then 'Boards'
        when 'boards' then 'Boards'
        when 'cable' then 'Cables'
        when 'cables' then 'Cables'
        when 'cooling' then 'Cooling'
        when 'cover' then 'Covers'
        when 'covers' then 'Covers'
        when 'drive' then 'Drives'
        when 'drives' then 'Drives'
        when 'drum' then 'Drums'
        when 'drums' then 'Drums'
        when 'duplex' then 'Duplex'
        when 'feeder' then 'Feeders'
        when 'feeders' then 'Feeders'
        when 'finishing' then 'Finishing'
        when 'fuser' then 'Fusers'
        when 'fusers' then 'Fusers'
        when 'hardware' then 'Hardware'
        when 'imaging' then 'Imaging'
        when 'maintenance' then 'Maintenance'
        when 'misc' then 'Miscellaneous'
        when 'miscellaneous' then 'Miscellaneous'
        when 'other' then 'Miscellaneous'
        when 'motor' then 'Motors'
        when 'motors' then 'Motors'
        when 'power supply' then 'Power Supplies'
        when 'power supplies' then 'Power Supplies'
        when 'roller' then 'Rollers'
        when 'rollers' then 'Rollers'
        when 'scanner adf' then 'Scanner / ADF'
        when 'scanner and adf' then 'Scanner / ADF'
        when 'sensor' then 'Sensors'
        when 'sensors' then 'Sensors'
        when 'transfer' then 'Transfer'
        when 'tray' then 'Trays'
        when 'trays' then 'Trays'
        when 'toner' then 'Toner / Consumables'
        when 'toner consumable' then 'Toner / Consumables'
        when 'toner consumables' then 'Toner / Consumables'
        else 'Miscellaneous'
      end
    end as normalized_category
  from parts
)
update parts as p
set category = n.normalized_category
from normalized_parts as n
where p.id = n.id
  and p.category is distinct from n.normalized_category;
