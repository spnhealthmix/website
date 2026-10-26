import { eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import { categories, productImages, productVariants, products, siteSettings } from "./schema";

type VariantSeed = {
  label: string;
  weightGrams: number;
  pricePaise: number;
};

type SeedItem = {
  name: string;
  slug: string;
  imageFile: string;
  shortDescription: string;
  description: string;
  ingredients: string | null;
  usage: string;
  variants: VariantSeed[];
};

type SeedCategory = {
  slug: string;
  name: string;
  items: SeedItem[];
};

const CATALOGUE: SeedCategory[] = [
  {
    slug: "health-mix-powders",
    name: "Health Mix Powders",
    items: [
      {
        name: "Nendram Raw Banana Powder",
        slug: "nendram-raw-banana-powder",
        imageFile: "nendram banana.jpg",
        shortDescription: "A convenient banana-based powder for everyday kitchen preparation.",
        description: "Nendram Raw Banana Powder brings a traditional ingredient into a convenient powdered format. Suitable preparation methods and serving suggestions should be confirmed with the product label.",
        ingredients: null,
        usage: "Follow the preparation instructions printed on the package.",
        variants: [
          { label: "250 g", weightGrams: 250, pricePaise: 24900 },
          { label: "500 g", weightGrams: 500, pricePaise: 44900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 79900 },
        ],
      },
      {
        name: "Karuppu Kavuni Kanji Mix",
        slug: "karuppu-kavuni-kanji-mix",
        imageFile: "black rice.jpg",
        shortDescription: "A traditional kanji mix inspired by Karuppu Kavuni rice.",
        description: "Karuppu Kavuni Kanji Mix offers a convenient format for preparing a traditional-style kanji at home.",
        ingredients: null,
        usage: "Prepare according to package instructions.",
        variants: [
          { label: "250 g", weightGrams: 250, pricePaise: 24900 },
          { label: "500 g", weightGrams: 500, pricePaise: 44900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 84900 },
        ],
      },
      {
        name: "Nuts Protein Powder",
        slug: "nuts-protein-powder",
        imageFile: "nuts protein.jpg",
        shortDescription: "A nut-based powder for convenient everyday preparation.",
        description: "Nuts Protein Powder is a convenient powder for customers looking to incorporate it into their regular food routine. Verify its composition and nutritional values before publishing specific claims.",
        ingredients: null,
        usage: "Follow the manufacturer's serving instructions.",
        variants: [
          { label: "100 g", weightGrams: 100, pricePaise: 29900 },
          { label: "250 g", weightGrams: 250, pricePaise: 39900 },
          { label: "500 g", weightGrams: 500, pricePaise: 69900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 129900 },
        ],
      },
      {
        name: "ABC Malt – Nuts Mixed Powder",
        slug: "abc-malt-nuts-mixed-powder",
        imageFile: "abc malt.jpg",
        shortDescription: "A convenient malt-style powder blended with nuts.",
        description: "ABC Malt – Nuts Mixed Powder is designed for convenient home preparation. Confirm the product's full composition and recommended preparation method before publishing detailed nutritional claims.",
        ingredients: null,
        usage: "Follow the preparation instructions on the packaging.",
        variants: [
          { label: "100 g", weightGrams: 100, pricePaise: 29900 },
          { label: "250 g", weightGrams: 250, pricePaise: 59900 },
          { label: "500 g", weightGrams: 500, pricePaise: 114900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 224900 },
        ],
      },
      {
        name: "Baby's Instant Cerelac",
        slug: "babys-instant-cerelac",
        imageFile: "baby's cerelac.jpg",
        shortDescription: "An instant-style cereal mix intended for preparation according to its package directions.",
        description: "Baby's Instant Cerelac is a packaged cereal mix. Its intended age group, ingredients, preparation instructions, allergens, and applicable regulatory requirements must be verified.",
        ingredients: null,
        usage: "Follow the verified product label and age-appropriate feeding instructions.",
        variants: [
          { label: "250 g", weightGrams: 250, pricePaise: 24900 },
          { label: "500 g", weightGrams: 500, pricePaise: 44900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 79900 },
        ],
      },
    ],
  },
  {
    slug: "podi-varieties",
    name: "Podi Varieties",
    items: [
      {
        name: "Paruppu Podi",
        slug: "paruppu-podi",
        imageFile: "PARUPPU PODI.jpg",
        shortDescription: "A traditional podi for serving alongside everyday South Indian meals.",
        description: "Paruppu Podi brings a familiar South Indian-style accompaniment to your dining table in a convenient packaged format.",
        ingredients: null,
        usage: "Follow the package serving suggestions.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 29900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 59900 },
        ],
      },
      {
        name: "Idli Podi",
        slug: "idli-podi",
        imageFile: "idli podi.jpg",
        shortDescription: "A traditional-style podi accompaniment for South Indian meals.",
        description: "Idli Podi provides a convenient packaged accompaniment option for breakfast and everyday meals.",
        ingredients: null,
        usage: "Follow the package serving instructions.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 29900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 59900 },
        ],
      },
      {
        name: "Poondu Podi",
        slug: "poondu-podi",
        imageFile: "poondu.jpg",
        shortDescription: "A garlic-themed podi for everyday meal accompaniment.",
        description: "Poondu Podi offers a convenient way to serve a garlic-based traditional-style podi alongside meals.",
        ingredients: null,
        usage: "Follow the package serving instructions.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 29900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 59900 },
        ],
      },
      {
        name: "Puliyodharai Podi",
        slug: "puliyodharai-podi",
        imageFile: "puliyodharai.jpg",
        shortDescription: "A traditional-style podi for preparing tamarind-rice-inspired meals.",
        description: "Puliyodharai Podi is a convenient packaged option for preparing a traditional-style puliyodharai dish at home.",
        ingredients: null,
        usage: "Follow the package rice-preparation instructions.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 24900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 59900 },
        ],
      },
      {
        name: "Moringa Leaves Sadham Podi",
        slug: "moringa-leaves-sadham-podi",
        imageFile: "Moringa leaves.jpg",
        shortDescription: "A moringa-leaf-themed podi for rice-based meals.",
        description: "Moringa Leaves Sadham Podi offers a convenient packaged accompaniment for traditional-style rice dishes.",
        ingredients: null,
        usage: "Follow the package serving instructions.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 24900 },
          { label: "500 g", weightGrams: 500, pricePaise: 39900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 69900 },
        ],
      },
      {
        name: "Karuveppilai Sadham Podi",
        slug: "karuveppilai-sadham-podi",
        imageFile: "karuveppilai.jpg",
        shortDescription: "A curry-leaf-themed podi for traditional rice preparations.",
        description: "Karuveppilai Sadham Podi provides a convenient packaged option for preparing curry-leaf-themed rice dishes.",
        ingredients: null,
        usage: "Follow the package serving instructions.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 24900 },
          { label: "500 g", weightGrams: 500, pricePaise: 39900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 69900 },
        ],
      },
    ],
  },
  {
    slug: "masalas-and-powders",
    name: "Masalas & Powders",
    items: [
      {
        name: "Red Chilli Powder",
        slug: "red-chilli-powder",
        imageFile: "Red Chilli.jpg",
        shortDescription: "A versatile chilli powder for everyday cooking.",
        description: "Red Chilli Powder is a kitchen staple for adding chilli flavour and heat to a variety of dishes.",
        ingredients: "Red chilli",
        usage: "Add during cooking according to taste.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 29900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 49900 },
        ],
      },
      {
        name: "Turmeric Powder",
        slug: "turmeric-powder",
        imageFile: "turmeric.jpg",
        shortDescription: "A versatile turmeric powder for everyday recipes.",
        description: "Turmeric Powder is a familiar kitchen ingredient used in a variety of traditional cooking preparations.",
        ingredients: "Turmeric",
        usage: "Add during cooking according to the recipe.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 29900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 49900 },
        ],
      },
      {
        name: "Coriander Powder",
        slug: "coriander-powder",
        imageFile: "Coriander.jpg",
        shortDescription: "A versatile coriander powder for everyday cooking.",
        description: "Coriander Powder provides a convenient way to include coriander flavour in traditional and everyday recipes.",
        ingredients: "Coriander",
        usage: "Add during cooking according to the recipe.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 29900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 49900 },
        ],
      },
      {
        name: "Black Pepper Powder",
        slug: "black-pepper-powder",
        imageFile: "black pepper.jpg",
        shortDescription: "A pepper powder for adding a distinctive spice note to dishes.",
        description: "Black Pepper Powder is a versatile kitchen seasoning suitable for a range of savoury recipes.",
        ingredients: "Black pepper",
        usage: "Add according to taste and recipe instructions.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 6900 },
          { label: "100 g", weightGrams: 100, pricePaise: 14900 },
          { label: "250 g", weightGrams: 250, pricePaise: 24900 },
          { label: "500 g", weightGrams: 500, pricePaise: 44900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 84900 },
        ],
      },
      {
        name: "Sambar Masala",
        slug: "sambar-masala",
        imageFile: "sambhar.jpg",
        shortDescription: "A convenient masala for preparing sambar-style dishes.",
        description: "Sambar Masala is designed for customers preparing traditional-style sambar and related home-cooked meals.",
        ingredients: null,
        usage: "Follow package directions and recipe quantities.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 29900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 49900 },
        ],
      },
      {
        name: "Rasam Powder",
        slug: "rasam-powder",
        imageFile: "Rasam.jpg",
        shortDescription: "A convenient powder for preparing traditional-style rasam.",
        description: "Rasam Powder makes it convenient to prepare a familiar South Indian-style rasam at home.",
        ingredients: null,
        usage: "Follow package preparation instructions.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 29900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 49900 },
        ],
      },
      {
        name: "Garam Masala",
        slug: "garam-masala",
        imageFile: "garam.jpg",
        shortDescription: "A versatile spice blend for savoury recipes.",
        description: "Garam Masala provides a convenient seasoning option for home-cooked dishes. Its precise flavour profile depends on the manufacturer's recipe.",
        ingredients: null,
        usage: "Add according to the recipe and package directions.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 29900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 49900 },
        ],
      },
      {
        name: "Meen Kuzhambu Masala",
        slug: "meen-kuzhambu-masala",
        imageFile: "meen kuzhambu.jpg",
        shortDescription: "A masala intended for traditional-style fish curry preparation.",
        description: "Meen Kuzhambu Masala offers a convenient seasoning option for preparing meen kuzhambu at home.",
        ingredients: null,
        usage: "Follow package directions and your recipe.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 29900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 49900 },
        ],
      },
      {
        name: "Chicken 65 Masala",
        slug: "chicken-65-masala",
        imageFile: "chicken 65.jpg",
        shortDescription: "A seasoning blend for preparing Chicken 65-style dishes.",
        description: "Chicken 65 Masala is a convenient seasoning option for preparing a familiar Indian-style chicken dish at home.",
        ingredients: null,
        usage: "Follow package seasoning and preparation directions.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 29900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 59900 },
        ],
      },
      {
        name: "Fish Fry Masala",
        slug: "fish-fry-masala",
        imageFile: "fish fry.jpg",
        shortDescription: "A seasoning blend for preparing fish-fry-style dishes.",
        description: "Fish Fry Masala provides a convenient seasoning option for home-cooked fish fry preparations.",
        ingredients: null,
        usage: "Follow package seasoning and cooking directions.",
        variants: [
          { label: "50 g", weightGrams: 50, pricePaise: 4900 },
          { label: "100 g", weightGrams: 100, pricePaise: 9900 },
          { label: "250 g", weightGrams: 250, pricePaise: 19900 },
          { label: "500 g", weightGrams: 500, pricePaise: 29900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 59900 },
        ],
      },
    ],
  },
  {
    slug: "snacks",
    name: "Snacks",
    items: [
      {
        name: "Kadalai Urundai",
        slug: "kadalai-urundai",
        imageFile: "Kadalai urundai.jpg",
        shortDescription: "A traditional-style peanut-based sweet in a convenient packaged format.",
        description: "Kadalai Urundai is a familiar traditional-style sweet suited to snack time and sharing.",
        ingredients: null,
        usage: "Confirm ready-to-eat status and serving details from the label.",
        variants: [
          { label: "250 g", weightGrams: 250, pricePaise: 14900 },
          { label: "500 g", weightGrams: 500, pricePaise: 24900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 44900 },
        ],
      },
      {
        name: "Ellu Urundai",
        slug: "ellu-urundai",
        imageFile: "Ellu Urundai.jpg",
        shortDescription: "A traditional-style sesame-based sweet in a convenient packaged format.",
        description: "Ellu Urundai is a familiar traditional-style sweet that can be enjoyed as a snack.",
        ingredients: null,
        usage: "Confirm ready-to-eat status and storage instructions from the label.",
        variants: [
          { label: "250 g", weightGrams: 250, pricePaise: 14900 },
          { label: "500 g", weightGrams: 500, pricePaise: 24900 },
          { label: "1 kg", weightGrams: 1000, pricePaise: 44900 },
        ],
      },
    ],
  },
  {
    slug: "thokku",
    name: "Thokku",
    items: [],
  },
];

const OBSOLETE_SLUGS = [
  "karuppu-ulundhu-kali-mix",
  "rich-biotin-powder",
  "sirudhaniya-sathu-maavu-mix",
  "sprouted-ragi-choco-malt",
  "diabetic-kanji-mix",
  "thakkali-thokku",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = getDb(url);

  // 1. Remove obsolete products if they have no historical references
  for (const obsSlug of OBSOLETE_SLUGS) {
    const [p] = await db.select().from(products).where(eq(products.slug, obsSlug));
    if (p) {
      await db.delete(products).where(eq(products.id, p.id));
    }
  }

  let productCount = 0;
  let variantCount = 0;

  for (const [catIndex, cat] of CATALOGUE.entries()) {
    await db
      .insert(categories)
      .values({ slug: cat.slug, name: cat.name, sortOrder: catIndex, isActive: true })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { name: cat.name, sortOrder: catIndex, isActive: true },
      });

    const [row] = await db.select().from(categories).where(eq(categories.slug, cat.slug));

    for (const [i, item] of cat.items.entries()) {
      await db
        .insert(products)
        .values({
          categoryId: row.id,
          slug: item.slug,
          name: item.name,
          shortDescription: item.shortDescription,
          description: item.description,
          ingredients: item.ingredients,
          usage: item.usage,
          sortOrder: i,
          isActive: true,
          isFeatured: false,
        })
        .onConflictDoUpdate({
          target: products.slug,
          set: {
            categoryId: row.id,
            name: item.name,
            shortDescription: item.shortDescription,
            description: item.description,
            ingredients: item.ingredients,
            usage: item.usage,
            sortOrder: i,
            isActive: true,
          },
        });

      const [prod] = await db.select().from(products).where(eq(products.slug, item.slug));

      // Upsert product primary image
      const r2Key = `products/${item.slug}/main.jpg`;
      const alt = `SPN Health Mix ${item.name} product packaging`;
      const [existingImg] = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, prod.id));

      if (existingImg) {
        await db
          .update(productImages)
          .set({ r2Key, alt, isPrimary: true, sortOrder: 0 })
          .where(eq(productImages.id, existingImg.id));
      } else {
        await db.insert(productImages).values({
          productId: prod.id,
          r2Key,
          alt,
          isPrimary: true,
          sortOrder: 0,
        });
      }

      // Upsert product variants (prices in integer paise, stock = 50, mrp = price)
      for (const v of item.variants) {
        const sku = `${item.slug}-${v.weightGrams}g`;
        await db
          .insert(productVariants)
          .values({
            productId: prod.id,
            sku,
            label: v.label,
            weightGrams: v.weightGrams,
            mrpPaise: v.pricePaise,
            pricePaise: v.pricePaise,
            stock: 50,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: productVariants.sku,
            set: {
              productId: prod.id,
              label: v.label,
              weightGrams: v.weightGrams,
              mrpPaise: v.pricePaise,
              pricePaise: v.pricePaise,
              stock: 50,
              isActive: true,
            },
          });
        variantCount++;
      }

      productCount++;
    }
  }

  await db
    .insert(siteSettings)
    .values([
      {
        key: "shipping",
        value: {
          flatRatePaise: 5000,
          freeShippingAbovePaise: 50000,
          tamilNaduFlatRatePaise: 5000,
          tamilNaduFreeShippingAbovePaise: 50000,
        },
      },
      { key: "contact", value: { email: null, phone: null, whatsapp: null } },
    ])
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value: sql`EXCLUDED.value`,
      },
    });

  console.log(`Seeded ${CATALOGUE.length} categories, ${productCount} products, and ${variantCount} variants with approved pack sizes, prices, and images.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
