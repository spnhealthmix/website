import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  fetchAllActiveCategories,
  fetchCategoryBySlug,
  fetchProducts,
} from "@/lib/storefront/api";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { CatalogueToolbar } from "@/components/catalogue/catalogue-toolbar";
import { Pagination } from "@/components/catalogue/pagination";
import type { SortOption } from "@/lib/storefront/types";

export const revalidate = 60;

const PAGE_SIZE = 16;

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sort?: string;
    offset?: string;
  }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await fetchCategoryBySlug(slug);

  if (!category) {
    return { title: "Category Not Found" };
  }

  return {
    title: `${category.name} — SPN Health Mix`,
    description:
      category.description ??
      `Shop traditional ${category.name} from SPN Health Mix. ${category.productCount} products available.`,
    alternates: { canonical: `/shop/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const sort = (sp.sort as SortOption) ?? "featured";
  const offset = Math.max(0, Number(sp.offset ?? 0));

  const [category, { categories }, productsData] = await Promise.all([
    fetchCategoryBySlug(slug),
    fetchAllActiveCategories(),
    fetchProducts({ category: slug, sort, limit: PAGE_SIZE, offset }),
  ]);

  // 404 if category is not active or doesn't exist
  if (!category) notFound();

  const { products, total } = productsData;
  const totalAllCategories = categories.reduce((sum, c) => sum + c.productCount, 0);

  return (
    <div className="py-8 lg:py-12 bg-[#FFFBF7] min-h-screen">
      <div className="container-spn">

        {/* Editorial Category Page Header */}
        <div className="mb-8">
          <h1
            className="text-3xl sm:text-4xl lg:text-[44px] text-[#1A1614] leading-[1.15] font-normal"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {category.name}
          </h1>
          {category.description && (
            <p className="font-[family-name:var(--font-body)] text-[15px] sm:text-[16px] text-[#635850] mt-2 max-w-2xl leading-relaxed">
              {category.description}
            </p>
          )}
          <p className="font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.14em] text-[#BF5330] mt-3">
            {total} {total === 1 ? "Product" : "Products"} in {category.name}
          </p>
        </div>

        {/* Category Filter and Sorting Controls Toolbar */}
        <Suspense>
          <CatalogueToolbar
            categories={categories}
            activeSlug={slug}
            totalCount={totalAllCategories}
            currentSort={sort}
          />
        </Suspense>

        {/* Product Grid in Homepage Bestseller Card Design */}
        {products.length > 0 ? (
          <>
            <ProductGrid products={products} priorityCount={4} />
            <Suspense>
              <Pagination total={total} limit={PAGE_SIZE} offset={offset} />
            </Suspense>
          </>
        ) : (
          <div className="py-20 text-center rounded-[20px] bg-white border border-[#E8DFD4] p-8">
            <p className="font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-wider text-[#635850] mb-2">
              Catalogue
            </p>
            <h2
              className="text-2xl text-[#1A1614] mb-3"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              No products in {category.name} right now
            </h2>
            <p className="font-[family-name:var(--font-body)] text-base text-[#635850] mb-6 max-w-sm mx-auto leading-relaxed">
              Have a look at everything else in the shop.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <Link
                href="/shop"
                className="inline-flex items-center justify-center h-10 px-5 font-[family-name:var(--font-body)] font-semibold text-sm text-white bg-[#BF5330] rounded-full hover:bg-[#8F3E20] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330]"
              >
                All Products
              </Link>
              {categories
                .filter((c) => c.slug !== slug && c.slug !== "thokku")
                .map((c) => (
                  <Link
                    key={c.slug}
                    href={`/shop/${c.slug}`}
                    className="inline-flex items-center h-10 px-4.5 rounded-full font-[family-name:var(--font-body)] text-sm font-medium text-[#1A1614] bg-[#FFFBF7] border border-[#E8DFD4] hover:border-[#BF5330] hover:text-[#BF5330] transition-colors"
                  >
                    {c.name}
                  </Link>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
