import { Client } from "pg";
import * as fs from "node:fs";

function loadEnv() {
  if (fs.existsSync(".env")) {
    const lines = fs.readFileSync(".env", "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

const PRODUCTS_DATA = [
  // Health Mix Powders
  {
    slug: "nendram-raw-banana-powder",
    shortDescription: "A convenient banana-based powder for everyday kitchen preparation.",
    description: "Nendram Raw Banana Powder brings a traditional ingredient into a convenient powdered format. Suitable preparation methods and serving suggestions should be confirmed with the product label.",
    usage: "Follow the preparation instructions printed on the package.",
    ingredients: null,
  },
  {
    slug: "karuppu-kavuni-kanji-mix",
    shortDescription: "A traditional kanji mix inspired by Karuppu Kavuni rice.",
    description: "Karuppu Kavuni Kanji Mix offers a convenient format for preparing a traditional-style kanji at home.",
    usage: "Prepare according to package instructions.",
    ingredients: null,
  },
  {
    slug: "nuts-protein-powder",
    shortDescription: "A nut-based powder for convenient everyday preparation.",
    description: "Nuts Protein Powder is a convenient powder for customers looking to incorporate it into their regular food routine. Verify its composition and nutritional values before publishing specific claims.",
    usage: "Follow the manufacturer's serving instructions.",
    ingredients: null,
  },
  {
    slug: "abc-malt-nuts-mixed-powder",
    shortDescription: "A convenient malt-style powder blended with nuts.",
    description: "ABC Malt – Nuts Mixed Powder is designed for convenient home preparation. Confirm the product's full composition and recommended preparation method before publishing detailed nutritional claims.",
    usage: "Follow the preparation instructions on the packaging.",
    ingredients: null,
  },
  {
    slug: "babys-instant-cerelac",
    shortDescription: "An instant-style cereal mix intended for preparation according to its package directions.",
    description: "Baby's Instant Cerelac is a packaged cereal mix. Its intended age group, ingredients, preparation instructions, allergens, and applicable regulatory requirements must be verified.",
    usage: "Follow the verified product label and age-appropriate feeding instructions.",
    ingredients: null,
  },

  // Podi Varieties
  {
    slug: "paruppu-podi",
    shortDescription: "A traditional podi for serving alongside everyday South Indian meals.",
    description: "Paruppu Podi brings a familiar South Indian-style accompaniment to your dining table in a convenient packaged format.",
    usage: "Follow the package serving suggestions.",
    ingredients: null,
  },
  {
    slug: "idli-podi",
    shortDescription: "A traditional-style podi accompaniment for South Indian meals.",
    description: "Idli Podi provides a convenient packaged accompaniment option for breakfast and everyday meals.",
    usage: "Follow the package serving instructions.",
    ingredients: null,
  },
  {
    slug: "poondu-podi",
    shortDescription: "A garlic-themed podi for everyday meal accompaniment.",
    description: "Poondu Podi offers a convenient way to serve a garlic-based traditional-style podi alongside meals.",
    usage: "Follow the package serving instructions.",
    ingredients: null,
  },
  {
    slug: "puliyodharai-podi",
    shortDescription: "A traditional-style podi for preparing tamarind-rice-inspired meals.",
    description: "Puliyodharai Podi is a convenient packaged option for preparing a traditional-style puliyodharai dish at home.",
    usage: "Follow the package rice-preparation instructions.",
    ingredients: null,
  },
  {
    slug: "moringa-leaves-sadham-podi",
    shortDescription: "A moringa-leaf-themed podi for rice-based meals.",
    description: "Moringa Leaves Sadham Podi offers a convenient packaged accompaniment for traditional-style rice dishes.",
    usage: "Follow the package serving instructions.",
    ingredients: null,
  },
  {
    slug: "karuveppilai-sadham-podi",
    shortDescription: "A curry-leaf-themed podi for traditional rice preparations.",
    description: "Karuveppilai Sadham Podi provides a convenient packaged option for preparing curry-leaf-themed rice dishes.",
    usage: "Follow the package serving instructions.",
    ingredients: null,
  },

  // Masalas & Powders
  {
    slug: "red-chilli-powder",
    shortDescription: "A versatile chilli powder for everyday cooking.",
    description: "Red Chilli Powder is a kitchen staple for adding chilli flavour and heat to a variety of dishes.",
    usage: "Add during cooking according to taste.",
    ingredients: "Red chilli",
  },
  {
    slug: "turmeric-powder",
    shortDescription: "A versatile turmeric powder for everyday recipes.",
    description: "Turmeric Powder is a familiar kitchen ingredient used in a variety of traditional cooking preparations.",
    usage: "Add during cooking according to the recipe.",
    ingredients: "Turmeric",
  },
  {
    slug: "coriander-powder",
    shortDescription: "A versatile coriander powder for everyday cooking.",
    description: "Coriander Powder provides a convenient way to include coriander flavour in traditional and everyday recipes.",
    usage: "Add during cooking according to the recipe.",
    ingredients: "Coriander",
  },
  {
    slug: "black-pepper-powder",
    shortDescription: "A pepper powder for adding a distinctive spice note to dishes.",
    description: "Black Pepper Powder is a versatile kitchen seasoning suitable for a range of savoury recipes.",
    usage: "Add according to taste and recipe instructions.",
    ingredients: "Black pepper",
  },
  {
    slug: "sambar-masala",
    shortDescription: "A convenient masala for preparing sambar-style dishes.",
    description: "Sambar Masala is designed for customers preparing traditional-style sambar and related home-cooked meals.",
    usage: "Follow package directions and recipe quantities.",
    ingredients: null,
  },
  {
    slug: "rasam-powder",
    shortDescription: "A convenient powder for preparing traditional-style rasam.",
    description: "Rasam Powder makes it convenient to prepare a familiar South Indian-style rasam at home.",
    usage: "Follow package preparation instructions.",
    ingredients: null,
  },
  {
    slug: "garam-masala",
    shortDescription: "A versatile spice blend for savoury recipes.",
    description: "Garam Masala provides a convenient seasoning option for home-cooked dishes. Its precise flavour profile depends on the manufacturer's recipe.",
    usage: "Add according to the recipe and package directions.",
    ingredients: null,
  },
  {
    slug: "meen-kuzhambu-masala",
    shortDescription: "A masala intended for traditional-style fish curry preparation.",
    description: "Meen Kuzhambu Masala offers a convenient seasoning option for preparing meen kuzhambu at home.",
    usage: "Follow package directions and your recipe.",
    ingredients: null,
  },
  {
    slug: "chicken-65-masala",
    shortDescription: "A seasoning blend for preparing Chicken 65-style dishes.",
    description: "Chicken 65 Masala is a convenient seasoning option for preparing a familiar Indian-style chicken dish at home.",
    usage: "Follow package seasoning and preparation directions.",
    ingredients: null,
  },
  {
    slug: "fish-fry-masala",
    shortDescription: "A seasoning blend for preparing fish-fry-style dishes.",
    description: "Fish Fry Masala provides a convenient seasoning option for home-cooked fish fry preparations.",
    usage: "Follow package seasoning and cooking directions.",
    ingredients: null,
  },

  // Snacks
  {
    slug: "kadalai-urundai",
    shortDescription: "A traditional-style peanut-based sweet in a convenient packaged format.",
    description: "Kadalai Urundai is a familiar traditional-style sweet suited to snack time and sharing.",
    usage: "Confirm ready-to-eat status and serving details from the label.",
    ingredients: null,
  },
  {
    slug: "ellu-urundai",
    shortDescription: "A traditional-style sesame-based sweet in a convenient packaged format.",
    description: "Ellu Urundai is a familiar traditional-style sweet that can be enjoyed as a snack.",
    usage: "Confirm ready-to-eat status and storage instructions from the label.",
    ingredients: null,
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = new Client({ connectionString: url });
  await client.connect();

  console.log("Starting idempotent update of 23 products...");

  let updatedCount = 0;
  for (const item of PRODUCTS_DATA) {
    const res = await client.query(
      `
      UPDATE products
      SET short_description = $1,
          description = $2,
          usage = $3,
          ingredients = $4,
          updated_at = NOW()
      WHERE slug = $5
      RETURNING id, slug, name;
      `,
      [item.shortDescription, item.description, item.usage, item.ingredients, item.slug]
    );

    if (res.rowCount === 0) {
      console.error(`Warning: Product with slug '${item.slug}' not found!`);
    } else {
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount}/${PRODUCTS_DATA.length} products.`);

  // Verify DB state
  const countRes = await client.query("SELECT count(*)::int as count FROM products;");
  console.log(`Verification: Total products in database: ${countRes.rows[0].count}`);

  const varRes = await client.query("SELECT count(*)::int as count FROM product_variants;");
  console.log(`Verification: Total variants in database (must be 0): ${varRes.rows[0].count}`);

  const imgRes = await client.query("SELECT count(*)::int as count FROM product_images;");
  console.log(`Verification: Total product images in database: ${imgRes.rows[0].count}`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
