import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fetchCategories, fetchProducts } from "@/lib/storefront/api";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { CatalogueToolbar } from "@/components/catalogue/catalogue-toolbar";
import { Pagination } from "@/components/catalogue/pagination";
import type { SortOption } from "@/lib/storefront/types";

export const metadata: Metadata = {
  title: "Shop All Products — SPN Health Mix",
  description: "Explore our traditional health mixes, podis, masalas, and snacks made with heritage recipes.",
  alternates: { canonical: "/shop" },
};

export const revalidate = 60;

const PAGE_SIZE = 16;

interface ShopPageProps {
  searchParams: Promise<{
    sort?: string;
    offset?: string;
  }>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const sort = (params.sort as SortOption) ?? "featured";
  const offset = Math.max(0, Number(params.offset ?? 0));

  const [{ categories }, productsData] = await Promise.all([
    fetchCategories(),
    fetchProducts({ sort, limit: PAGE_SIZE, offset }),
  ]);

  const { products, total } = productsData;
  const totalAllCategories = categories.reduce((sum, c) => sum + c.productCount, 0);

  return (
    <div className="py-8 lg:py-12 bg-[#FFFBF7] min-h-screen">
      <div className="container-spn">

        {/* Editorial Page Header */}
        <div className="mb-8">
          <h1
            className="text-3xl sm:text-4xl lg:text-[44px] text-[#1A1614] leading-[1.15] font-normal"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            All Products
          </h1>
          <p className="font-[family-name:var(--font-body)] text-[15px] sm:text-[16px] text-[#635850] mt-2 max-w-2xl leading-relaxed">
            Explore our traditional health mixes, podis, masalas and snacks.
          </p>
          <p className="font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-[0.14em] text-[#BF5330] mt-3">
            {total} {total === 1 ? "Product" : "Products"} Available
          </p>
        </div>

        {/* Category Filter and Sorting Controls Toolbar */}
        <Suspense>
          <CatalogueToolbar
            categories={categories}
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
              No products available right now
            </h2>
            <p className="font-[family-name:var(--font-body)] text-base text-[#635850] mb-6 max-w-sm mx-auto leading-relaxed">
              Browse a category or check back later.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {[
                { label: "Health Mix Powders", href: "/shop/health-mix-powders" },
                { label: "Podi Varieties", href: "/shop/podi-varieties" },
                { label: "Masalas & Powders", href: "/shop/masalas-and-powders" },
                { label: "Snacks", href: "/shop/snacks" },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center h-10 px-4.5 rounded-full font-[family-name:var(--font-body)] text-sm font-medium text-[#1A1614] bg-[#FFFBF7] border border-[#E8DFD4] hover:border-[#BF5330] hover:text-[#BF5330] transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
