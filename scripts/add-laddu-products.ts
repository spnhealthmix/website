import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/index";
import { categories, productImages, productVariants, products } from "../src/lib/db/schema";

interface LadduSeed {
  name: string;
  slug: string;
  imageKey: string;
  shortDescription: string;
  description: string;
  ingredients: string;
  usage: string;
  variants: {
    label: string;
    weightGrams: number;
    pricePaise: number;
  }[];
}

const NEW_PRODUCTS: LadduSeed[] = [
  {
    name: "Rava Laddu",
    slug: "rava-laddu",
    imageKey: "products/rava-laddu/main.png",
    shortDescription: "Traditional homemade rava laddu prepared with roasted semolina, pure ghee, cardamom, and nuts.",
    description: "SPN Health Mix Rava Laddu is a traditional South Indian sweet prepared using fine roasted semolina (rava), pure melted ghee, fragrant cardamom, cashews, and raisins. Made fresh in small batches without artificial preservatives.",
    ingredients: "Semolina (Rava), Pure Ghee, Cane Sugar, Cashews, Raisins, Cardamom.",
    usage: "Ready to eat traditional delicacy. Ideal for festival celebrations, family gatherings, or evening snacks.",
    variants: [
      { label: "250 g", weightGrams: 250, pricePaise: 14900 },
      { label: "500 g", weightGrams: 500, pricePaise: 24900 },
      { label: "1 kg", weightGrams: 1000, pricePaise: 44900 },
    ],
  },
  {
    name: "Karuppu Kavuni Laddu",
    slug: "karuppu-kavuni-laddu",
    imageKey: "products/karuppu-kavuni-laddu/main.png",
    shortDescription: "Nutritious traditional laddu crafted from heritage black rice (Karuppu Kavuni) and pure ghee.",
    description: "Karuppu Kavuni Laddu brings together the ancient heritage and antioxidant richness of black rice with traditional country sweetness and pure ghee. A nourishing snack suitable for all ages.",
    ingredients: "Karuppu Kavuni (Black Rice), Pure Ghee, Country Sugar / Jaggery, Cardamom, Dry Fruits.",
    usage: "Healthy guilt-free treat. Enjoy 1-2 laddus daily with milk or as a nutritious afternoon snack.",
    variants: [
      { label: "250 g", weightGrams: 250, pricePaise: 14900 },
      { label: "500 g", weightGrams: 500, pricePaise: 24900 },
      { label: "1 kg", weightGrams: 1000, pricePaise: 44900 },
    ],
  },
  {
    name: "Sprouted Ragi Choco Laddu",
    slug: "sprouted-ragi-choco-laddu",
    imageKey: "products/sprouted-ragi-choco-laddu/main.png",
    shortDescription: "Wholesome calcium-rich sprouted finger millet laddu naturally flavoured with rich chocolate.",
    description: "Sprouted Ragi Choco Laddu is an energy-dense, child-friendly snack combining the bio-available goodness of sprouted ragi (finger millet) with tempting chocolate notes and traditional sweetness.",
    ingredients: "Sprouted Ragi (Finger Millet), Cocoa, Pure Ghee, Jaggery / Cane Sugar, Cardamom.",
    usage: "Healthy snack for kids and adults alike. Perfect for school lunchboxes or post-workout energy.",
    variants: [
      { label: "250 g", weightGrams: 250, pricePaise: 14900 },
      { label: "500 g", weightGrams: 500, pricePaise: 24900 },
      { label: "1 kg", weightGrams: 1000, pricePaise: 44900 },
    ],
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const db = getDb(databaseUrl);

  // 1. Fetch the "snacks" category
  const [snacksCat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, "snacks"))
    .limit(1);

  if (!snacksCat) {
    throw new Error("Category 'snacks' not found in database.");
  }

  console.log(`Using Category: ${snacksCat.name} (id: ${snacksCat.id})`);

  for (let i = 0; i < NEW_PRODUCTS.length; i++) {
    const item = NEW_PRODUCTS[i];

    // Upsert product record
    await db
      .insert(products)
      .values({
        categoryId: snacksCat.id,
        name: item.name,
        slug: item.slug,
        shortDescription: item.shortDescription,
        description: item.description,
        ingredients: item.ingredients,
        usage: item.usage,
        sortOrder: 10 + i,
        isActive: true,
        isFeatured: true,
      })
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          categoryId: snacksCat.id,
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
    const alt = `SPN Health Mix ${item.name} packaging`;
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
      console.log(`  Upserted variant: ${sku} -> ₹${v.pricePaise / 100} (stock: 50)`);
    }
  }

  console.log("\nAll 3 products have been successfully inserted into database!");
}

main().catch((err) => {
  console.error("Migration script error:", err);
  process.exit(1);
});
