import { Suspense } from "react";
import { SiteNav } from "@/components/layout/site-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { fetchAllActiveCategories } from "@/lib/storefront/api";
import { fetchBusinessSettings } from "@/lib/settings/service";
import { ToastProvider } from "@/components/ui/toast";
import { CartProvider } from "@/context/cart-context";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Categories and business settings are used in the nav and footer.
  // Fetched at layout level and passed down.
  const [{ categories }, businessSettings] = await Promise.all([
    fetchAllActiveCategories(),
    fetchBusinessSettings(),
  ]);

  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <CartProvider>
          <div className="flex flex-col min-h-screen">
            <Suspense>
              <SiteNav categories={categories} />
            </Suspense>

            <main id="main-content" className="flex-1">
              {children}
            </main>

            <SiteFooter categories={categories} settings={businessSettings} />
          </div>
        </CartProvider>
      </Suspense>
    </ToastProvider>
  );
}
