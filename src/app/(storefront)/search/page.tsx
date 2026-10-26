import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fetchCategories, fetchProducts } from "@/lib/storefront/api";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { SortSelect } from "@/components/catalogue/sort-select";
import { Pagination } from "@/components/catalogue/pagination";
import { SearchBar } from "@/components/search/search-bar";
import type { SortOption } from "@/lib/storefront/types";

// Search result pages should not be indexed
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 20;

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    offset?: string;
  }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const sort = (params.sort as SortOption) ?? "relevance";
  const offset = Math.max(0, Number(params.offset ?? 0));

  const hasQuery = query.length >= 2;

  // Fetch categories from DB and search results if query exists
  const [{ categories }, productsData] = await Promise.all([
    fetchCategories(),
    hasQuery
      ? fetchProducts({ q: query, sort, limit: PAGE_SIZE, offset })
      : Promise.resolve(null),
  ]);

  const total = productsData?.total ?? 0;
  const products = productsData?.products ?? [];

  return (
    <div className="py-8 lg:py-12">
      <div className="container-spn">

        {/* Search input */}
        <div className="max-w-2xl mb-8">
          <Suspense>
            <SearchBar
              defaultValue={query}
              autoFocus={!hasQuery}
            />
          </Suspense>
        </div>

        {/* Results header */}
        {hasQuery && (
          <div className="mb-6">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl lg:text-3xl text-[var(--color-text-primary)]">
              Results for &ldquo;{query}&rdquo;
            </h1>
            <p
              className="font-[family-name:var(--font-body)] text-sm text-[var(--color-text-muted)] mt-1"
              aria-live="polite"
            >
              {total} product{total !== 1 ? "s" : ""} found
            </p>
          </div>
        )}

        {!hasQuery && (
          <div className="py-12">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-text-primary)] mb-2">
              Find something good
            </h1>
            <p className="font-[family-name:var(--font-body)] text-base text-[var(--color-text-muted)] mb-8">
              Search by name, ingredient, or type — like &ldquo;health mix&rdquo; or &ldquo;podi&rdquo;.
            </p>
            <div>
              <p className="font-[family-name:var(--font-body)] text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Browse by category</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/shop/${c.slug}`}
                    className="inline-flex items-center h-9 px-4 font-[family-name:var(--font-product)] text-sm font-medium text-[var(--color-text-body)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-[8px] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* No results */}
        {hasQuery && products.length === 0 && (
          <div className="py-16">
            <p className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-text-primary)] mb-3">
              Nothing matched &ldquo;{query}&rdquo;
            </p>
            <p className="font-[family-name:var(--font-body)] text-base text-[var(--color-text-muted)] mb-7">
              Try a shorter word, check the spelling, or browse a category below.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="inline-flex items-center justify-center h-11 px-6 font-[family-name:var(--font-body)] font-semibold text-base text-white bg-[var(--color-brand-primary)] rounded-[8px] hover:bg-[var(--color-brand-primary-dark)] active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] shadow-xs"
              >
                Browse all products
              </Link>
              {categories.slice(0, 4).map((c) => (
                <Link
                  key={c.slug}
                  href={`/shop/${c.slug}`}
                  className="inline-flex items-center h-11 px-5 font-[family-name:var(--font-product)] text-sm font-medium text-[var(--color-text-body)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-[8px] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {hasQuery && products.length > 0 && (
          <>
            {/* Sort bar */}
            <div
              id="product-grid-top"
              className="sticky top-14 lg:top-16 z-20 bg-[var(--color-surface)] border-b border-[var(--color-border)] -mx-4 px-4 md:-mx-6 md:px-6 xl:-mx-10 xl:px-10 h-12 flex items-center justify-end mb-8"
            >
              <Suspense>
                <SortSelect currentSort={sort} isSearch />
              </Suspense>
            </div>

            <ProductGrid products={products} priorityCount={4} />

            <Suspense>
              <Pagination total={total} limit={PAGE_SIZE} offset={offset} />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}
