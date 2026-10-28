import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/index";
import { categories, productImages, productVariants, products } from "../src/lib/db/schema";

export interface ComboSeed {
  name: string;
  slug: string;
  categorySlug: string;
  imageKey: string;
  shortDescription: string;
  description: string;
  ingredients: string;
  usage: string;
  variants: {
    label: string;
    sku: string;
    weightGrams: number;
    pricePaise: number;
    mrpPaise: number;
    stock: number;
  }[];
}

export const COMBO_PRODUCTS: ComboSeed[] = [
  {
    name: "Family Combo Offer",
    slug: "family-combo-offer",
    categorySlug: "health-mix-powders",
    imageKey: "hero1.jpeg",
    shortDescription: "Diwali Special 12-item family combo: Health mixes, spice masalas, podis, and traditional sweets.",
    description: "SPN Health Mix Diwali Special Family Combo Offer brings together our full traditional range: Sirudhaniya Sathu Maavu (250g), Sprouted Ragi Choco Malt (100g), Karuppu Kavuni Kanji Mix (250g), Sambar Powder (50g), Rasam Powder (50g), Meen Kuzhambu Masala (50g), Chicken 65 Masala (50g), Idli Podi (50g), Paruppu Podi (50g), Puliyodharai Podi (50g), Kadalai Urundai (250g), and Ellu Urundai (250g). Total 12 items.",
    ingredients: "Heirloom grains, millets, roasted pulses, pure spices, cold-pressed sesame oil, pure ghee, country sugar, and jaggery.",
    usage: "Complete festive hamper for traditional family meals, breakfast, and wholesome snacking.",
    variants: [
      {
        label: "12 Items Pack",
        sku: "family-combo-12in1",
        weightGrams: 1500,
        pricePaise: 99900,
        mrpPaise: 159900,
        stock: 50,
      },
    ],
  },
  {
    name: "Fast Moving Sweet Laddu's Combo",
    slug: "sweet-laddus-combo",
    categorySlug: "snacks",
    imageKey: "hero2.jpeg",
    shortDescription: "Diwali Special 4-pack sweet laddus: Kadalai Urundai, Ellu Urundai, Rava Laddu, and Karuppu Kavuni Laddu (250g each).",
    description: "Handcrafted traditional South Indian sweets prepared with pure melted ghee, wholesome roasted nuts, sesame, jaggery, and heritage grains. Contains Kadalai Urundai Laddu (250g), Ellu Urundai Laddu (250g), Rava Laddu (250g), and Karuppu Kavuni Laddu (250g). Total 1 kg.",
    ingredients: "Peanuts, Black Sesame, Fine Semolina, Karuppu Kavuni Black Rice, Pure Ghee, Country Sugar, Jaggery, Cardamom, Cashews, Raisins.",
    usage: "Ready to eat traditional festival sweets and evening snacks.",
    variants: [
      {
        label: "4 × 250g Pack",
        sku: "sweet-laddus-combo-1kg",
        weightGrams: 1000,
        pricePaise: 49900,
        mrpPaise: 69900,
        stock: 50,
      },
    ],
  },
  {
    name: "Spicy Podi Varieties Combo",
    slug: "spicy-podi-varieties-combo",
    categorySlug: "podi-varieties",
    imageKey: "hero3.jpeg",
    shortDescription: "Diwali Special 6-pack authentic South Indian podi varieties (50g each).",
    description: "A flavourful South Indian meal accompaniment collection: Paruppu Podi (50g), Idli Podi (50g), Poondu Podi (50g), Puliyodharai Podi (50g), Karuveppilai Sadham Podi (50g), and Murungai Leaves Sadham Podi (50g). Total 300g.",
    ingredients: "Roasted Bengal Gram, Toor Dal, Urad Dal, Garlic, Curry Leaves, Moringa Leaves, Tamarind, Red Chilli, Hing, Salt.",
    usage: "Mix with hot steamed rice and melted ghee, or serve with idlis and dosas.",
    variants: [
      {
        label: "6 × 50g Pack",
        sku: "spicy-podi-combo-300g",
        weightGrams: 300,
        pricePaise: 34900,
        mrpPaise: 39900,
        stock: 50,
      },
    ],
  },
  {
    name: "Nendram Banana Chips",
    slug: "nendram-banana-chips",
    categorySlug: "snacks",
    imageKey: "hero4.jpeg",
    shortDescription: "Authentic crispy golden Kerala-style Nendram banana chips.",
    description: "Authentic traditional style Nendram banana chips sliced from naturally matured plantains and crisped to golden perfection. Free from artificial colours, flavours, or chemical preservatives.",
    ingredients: "Raw Nendram Bananas, Vegetable Oil, Turmeric, Salt.",
    usage: "Ready to eat crispy festive snack.",
    variants: [
      {
        label: "250 g",
        sku: "banana-chips-250g",
        weightGrams: 250,
        pricePaise: 11900,
        mrpPaise: 11900,
        stock: 100,
      },
      {
        label: "500 g",
        sku: "banana-chips-500g",
        weightGrams: 500,
        pricePaise: 21900,
        mrpPaise: 21900,
        stock: 100,
      },
      {
        label: "1 kg",
        sku: "banana-chips-1kg",
        weightGrams: 1000,
        pricePaise: 42900,
        mrpPaise: 42900,
        stock: 50,
      },
    ],
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const db = getDb(databaseUrl);

  const allCategories = await db.select().from(categories);
  const catMap = new Map(allCategories.map((c) => [c.slug, c.id]));

  for (let i = 0; i < COMBO_PRODUCTS.length; i++) {
    const item = COMBO_PRODUCTS[i];
    const categoryId = catMap.get(item.categorySlug) ?? catMap.get("snacks");
    if (!categoryId) {
      throw new Error(`Category ${item.categorySlug} not found.`);
    }

    // Upsert product record
    await db
      .insert(products)
      .values({
        categoryId,
        name: item.name,
        slug: item.slug,
        shortDescription: item.shortDescription,
        description: item.description,
        ingredients: item.ingredients,
        usage: item.usage,
        sortOrder: 50 + i,
        isActive: true,
        isFeatured: true,
      })
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          categoryId,
          name: item.name,
          shortDescription: item.shortDescription,
          description: item.description,
          ingredients: item.ingredients,
          usage: item.usage,
          isActive: true,
          isFeatured: true,
          updatedAt: new Date(),
        },
      });

    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.slug, item.slug));

    console.log(`Product upserted: ${prod.name} (${prod.id})`);

    // Upsert primary image record
    const alt = `SPN Health Mix ${item.name} promotional poster`;
    const [existingImg] = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, prod.id))
      .limit(1);

    if (existingImg) {
      await db
        .update(productImages)
        .set({
          r2Key: item.imageKey,
          alt,
          isPrimary: true,
          sortOrder: 0,
        })
        .where(eq(productImages.id, existingImg.id));
      console.log(`  Updated primary image: ${item.imageKey}`);
    } else {
      await db.insert(productImages).values({
        productId: prod.id,
        r2Key: item.imageKey,
        alt,
        isPrimary: true,
        sortOrder: 0,
      });
      console.log(`  Inserted primary image: ${item.imageKey}`);
    }

    // Upsert variants
    for (const v of item.variants) {
      await db
        .insert(productVariants)
        .values({
          productId: prod.id,
          sku: v.sku,
          label: v.label,
          weightGrams: v.weightGrams,
          mrpPaise: v.mrpPaise,
          pricePaise: v.pricePaise,
          stock: v.stock,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: productVariants.sku,
          set: {
            productId: prod.id,
            label: v.label,
            weightGrams: v.weightGrams,
            mrpPaise: v.mrpPaise,
            pricePaise: v.pricePaise,
            stock: v.stock,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      console.log(`  Upserted variant: ${v.sku} [${v.label}] -> ₹${v.pricePaise / 100} (stock: ${v.stock})`);
    }
  }

  console.log("\nAll combo products and variants have been successfully synced to the database!");
}

main().catch((err) => {
  console.error("Failed to seed combo products:", err);
  process.exit(1);
});

