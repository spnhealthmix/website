import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const shippingConfig = {
  flatRatePaise: 5000,
  freeShippingAbovePaise: 50000,
  tamilNaduFlatRatePaise: 5000,
  tamilNaduFreeShippingAbovePaise: 50000,
};

const res = await pool.query(
  `INSERT INTO site_settings (key, value, updated_at)
   VALUES ($1, $2, NOW())
   ON CONFLICT (key) DO UPDATE
   SET value = EXCLUDED.value,
       updated_at = NOW()
   RETURNING *;`,
  ["shipping", JSON.stringify(shippingConfig)],
);

console.log("Updated shipping configuration in development database:", JSON.stringify(res.rows[0], null, 2));

// Verify other tables are completely preserved
const counts = await pool.query(`
  SELECT 
    (SELECT count(*) FROM profiles) as profiles_count,
    (SELECT count(*) FROM orders) as orders_count,
    (SELECT count(*) FROM products) as products_count,
    (SELECT count(*) FROM payments) as payments_count;
`);
console.log("Preserved existing data counts:", counts.rows[0]);

await pool.end();
