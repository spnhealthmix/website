import { getDb } from "../src/lib/db";
import { products, productVariants, categories } from "../src/lib/db/schema";
import { eq, sql, asc } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}
const db = getDb(databaseUrl);

// Expected price table based on user specification & PDF price list
// Values in INR (will check against pricePaise = priceINR * 100)
const EXPECTED_PRICES: Record<string, Record<string, number>> = {
  // Health Mix Powders
  "nendram-raw-banana-powder": { "250 g": 249, "500 g": 449, "1 kg": 799 },
  "karuppu-kavuni-kanji-mix": { "250 g": 249, "500 g": 449, "1 kg": 849 },
  "nuts-protein-powder": { "100 g": 299, "250 g": 399, "500 g": 699, "1 kg": 1299 },
  "abc-malt-nuts-mixed-powder": { "100 g": 299, "250 g": 599, "500 g": 1149, "1 kg": 2249 },
  "babys-instant-cerelac": { "250 g": 249, "500 g": 449, "1 kg": 799 },

  // Podi Varieties
  "paruppu-podi": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 299, "1 kg": 599 },
  "idli-podi": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 299, "1 kg": 599 },
  "poondu-podi": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 299, "1 kg": 599 },
  "puliyodharai-podi": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 249, "1 kg": 599 },
  "moringa-leaves-sadham-podi": { "50 g": 49, "100 g": 99, "250 g": 249, "500 g": 399, "1 kg": 699 },
  "karuveppilai-sadham-podi": { "50 g": 49, "100 g": 99, "250 g": 249, "500 g": 399, "1 kg": 699 },

  // Masalas & Powders
  "red-chilli-powder": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 299, "1 kg": 499 },
  "turmeric-powder": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 299, "1 kg": 499 },
  "coriander-powder": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 299, "1 kg": 499 },
  "black-pepper-powder": { "50 g": 69, "100 g": 149, "250 g": 249, "500 g": 449, "1 kg": 849 },
  "sambar-masala": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 299, "1 kg": 499 },
  "rasam-powder": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 299, "1 kg": 499 },
  "garam-masala": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 299, "1 kg": 499 },
  "meen-kuzhambu-masala": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 299, "1 kg": 499 },
  "chicken-65-masala": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 299, "1 kg": 599 },
  "fish-fry-masala": { "50 g": 49, "100 g": 99, "250 g": 199, "500 g": 299, "1 kg": 599 },

  // Snacks
  "kadalai-urundai": { "250 g": 149, "500 g": 249, "1 kg": 449 },
  "ellu-urundai": { "250 g": 149, "500 g": 249, "1 kg": 449 },
};

async function verify() {
  console.log("==================================================");
  console.log("   SPN FOODS — PRICING & DATABASE VERIFICATION   ");
  console.log("==================================================\n");

  // 1. Query counts
  const allProds = await db.select().from(products).orderBy(asc(products.slug));
  const allVars = await db.select().from(productVariants).orderBy(asc(productVariants.sku));
  const allCats = await db.select().from(categories).orderBy(asc(categories.slug));

  console.log(`[1] Database Records Count:`);
  console.log(`    - Categories: ${allCats.length}`);
  console.log(`    - Products:   ${allProds.length} (Expected: 23)`);
  console.log(`    - Variants:   ${allVars.length} (Expected: 103)`);

  if (allProds.length !== 23) {
    console.error(`ERROR: Expected 23 products, found ${allProds.length}`);
  }
  if (allVars.length !== 103) {
    console.error(`ERROR: Expected 103 variants, found ${allVars.length}`);
  }

  // 2. Check each product and its variants
  let passedVariants = 0;
  let discrepancies = 0;

  console.log(`\n[2] Detailed Product & Variant Verification:`);

  for (const prod of allProds) {
    const expectedForProd = EXPECTED_PRICES[prod.slug];
    if (!expectedForProd) {
      console.warn(`    WARNING: Product ${prod.slug} not in expected price list map!`);
      continue;
    }

    const prodVars = allVars.filter((v) => v.productId === prod.id);
    const expectedSizes = Object.keys(expectedForProd);

    if (prodVars.length !== expectedSizes.length) {
      console.error(`    FAIL [${prod.slug}]: Expected ${expectedSizes.length} variants, found ${prodVars.length}`);
      discrepancies++;
    }

    for (const v of prodVars) {
      const expectedINR = expectedForProd[v.label];
      const expectedPaise = expectedINR !== undefined ? expectedINR * 100 : undefined;

      if (expectedPaise === undefined) {
        console.error(`    FAIL [${prod.slug}]: Unexpected pack size ${v.label}`);
        discrepancies++;
        continue;
      }

      if (v.pricePaise !== expectedPaise) {
        console.error(`    FAIL [${prod.slug} - ${v.label}]: Expected ${expectedPaise} paise (₹${expectedINR}), found ${v.pricePaise} paise`);
        discrepancies++;
      } else if (v.mrpPaise !== v.pricePaise) {
        console.error(`    FAIL [${prod.slug} - ${v.label}]: mrpPaise (${v.mrpPaise}) != pricePaise (${v.pricePaise})`);
        discrepancies++;
      } else if (!Number.isInteger(v.pricePaise)) {
        console.error(`    FAIL [${prod.slug} - ${v.label}]: pricePaise is not an integer (${v.pricePaise})`);
        discrepancies++;
      } else {
        passedVariants++;
      }
    }
  }

  console.log(`\n[3] Price List Audit Result:`);
  console.log(`    - Validated Variants: ${passedVariants} / 103`);
  console.log(`    - Discrepancies:      ${discrepancies}`);

  // 4. Schema mrpPaise Nullability check
  console.log(`\n[4] mrpPaise Nullability & Integrity Analysis:`);
  console.log(`    - product_variants schema defines mrp_paise as NOT NULL.`);
  console.log(`    - Table check constraint 'variants_price_ok' requires: price_paise <= mrp_paise.`);
  console.log(`    - By setting mrp_paise = price_paise, no artificial MRP or fictitious discounts were fabricated.`);

  if (discrepancies === 0 && allProds.length === 23 && allVars.length === 103) {
    console.log(`\n>>> ALL DATABASE PRICING CHECKS PASSED PERFECTLY <<<\n`);
    process.exit(0);
  } else {
    console.error(`\n>>> DATABASE PRICING VERIFICATION FOUND DISCREPANCIES <<<\n`);
    process.exit(1);
  }
}

verify().catch((err) => {
  console.error("Verification script failed with error:", err);
  process.exit(1);
});
