import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchProduct, fetchProductRatingSummary } from "@/lib/storefront/api";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { ProductImageGallery } from "@/components/catalogue/product-image-gallery";
import { ProductPurchasePanel } from "@/components/catalogue/product-purchase-panel";
import { AboutProductCard } from "@/components/catalogue/about-product-card";
import { ProductReviewsSection } from "@/components/reviews/product-reviews-section";

export const revalidate = 60;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ variant?: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await fetchProduct(slug);
    const firstImage = product.images.find((i) => i.isPrimary) ?? product.images[0];

    return {
      title: product.name,
      description:
        product.shortDescription ??
        (product.description ? product.description.slice(0, 155) : undefined),
      alternates: { canonical: `/products/${slug}` },
      openGraph: {
        images: firstImage ? [{ url: firstImage.url, alt: firstImage.alt ?? product.name }] : [],
      },
    };
  } catch {
    return { title: "Product Not Found" };
  }
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const initialVariantId = sp?.variant;

  let product;
  try {
    product = await fetchProduct(slug);
  } catch {
    notFound();
  }

  const ratingSummary = await fetchProductRatingSummary(product.id).catch(() => ({
    averageRating: 0,
    totalReviews: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  }));

  // Structured data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? product.shortDescription ?? undefined,
    brand: { "@type": "Brand", name: "SPN Health Mix" },
    image: product.images.map((i) => i.url),
    ...(ratingSummary.totalReviews > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: ratingSummary.averageRating,
            reviewCount: ratingSummary.totalReviews,
          },
        }
      : {}),
    ...(product.variants.length > 0
      ? {
          offers: product.variants.map((v) => ({
            "@type": "Offer",
            price: (v.pricePaise / 100).toFixed(2),
            priceCurrency: "INR",
            availability: v.inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            name: v.label,
          })),
        }
      : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Shop", item: "/shop" },
      {
        "@type": "ListItem",
        position: 3,
        name: product.category.name,
        item: `/shop/${product.category.slug}`,
      },
      { "@type": "ListItem", position: 4, name: product.name },
    ],
  };

  // Default to cheapest variant
  const defaultVariant = product.variants[0];

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="py-6 lg:py-10">
        <div className="container-spn">

          {/* Two-column layout matching reference design */}
          <div className="grid grid-cols-1 lg:grid-cols-[52%_48%] xl:grid-cols-[54%_46%] gap-8 lg:gap-12 xl:gap-16 items-start">

            {/* Left: Product Image Gallery */}
            <div className="lg:sticky lg:top-[96px]">
              <ProductImageGallery
                images={product.images}
                productName={product.name}
              />
            </div>

            {/* Right: Product Details (exact 8 items in requested order) */}
            <div>
              <ProductPurchasePanel
                product={product}
                initialVariantId={initialVariantId}
              />

            </div>
          </div>

          {/* Middle Section: About This Product & Customer Reviews side by side on desktop, stacked on mobile */}
          <div className="mt-10 lg:mt-14 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
            {/* About This Product Card */}
            <AboutProductCard
              name={product.name}
              description={product.description ?? product.shortDescription}
            />

            {/* Customer Reviews Card */}
            <ProductReviewsSection
              productSlug={slug}
              initialSummary={ratingSummary}
            />
          </div>

          {/* ── Related products ──────────────────────────────────────────── */}
          {product.related.length > 0 && (
            <div className="mt-12 lg:mt-16">
              <h2 className="font-[family-name:var(--font-heading)] text-xl lg:text-2xl text-[var(--color-text-primary)] mb-6">
                From the same category
              </h2>
              <ProductGrid products={product.related} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
