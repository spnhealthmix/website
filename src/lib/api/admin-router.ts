import * as api from "./admin-api";
import type { ApiDeps } from "./customer-api";

/**
 * Single dispatcher for all admin API endpoints.
 * Compatible with Next.js App Router route handlers, Cloudflare Worker fetch handlers,
 * and test harnesses.
 */
export async function dispatchAdminRequest(
  req: Request,
  deps: ApiDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  let m: RegExpMatchArray | null;

  // Dashboard
  if (path === "/api/admin/dashboard" && method === "GET") {
    return api.adminDashboardH(req, deps);
  }

  // Orders
  if (path === "/api/admin/orders" && method === "GET") {
    return api.adminListOrders(req, deps);
  }
  if ((m = path.match(/^\/api\/admin\/orders\/([^/]+)\/status$/)) && (method === "POST" || method === "PATCH")) {
    return api.adminOrderStatus(req, deps, m[1]);
  }
  if ((m = path.match(/^\/api\/admin\/orders\/([^/]+)\/notes?$/)) && method === "PATCH") {
    return api.adminOrderNote(req, deps, m[1]);
  }
  if ((m = path.match(/^\/api\/admin\/orders\/([^/]+)\/shipment\/create$/)) && method === "POST") {
    return api.adminCreateOrderShipment(req, deps, m[1]);
  }
  if ((m = path.match(/^\/api\/admin\/orders\/([^/]+)\/shipment\/sync$/)) && method === "POST") {
    return api.adminSyncOrderTracking(req, deps, m[1]);
  }
  if ((m = path.match(/^\/api\/admin\/orders\/([^/]+)\/shipment$/))) {
    if (method === "POST") return api.adminCreateOrderShipment(req, deps, m[1]);
    if (method === "PATCH") return api.adminOrderShipment(req, deps, m[1]);
  }

  if ((m = path.match(/^\/api\/admin\/orders\/([^/]+)\/(?:refund\/resolve|resolve-attention)$/)) && method === "POST") {
    return api.adminResolveRefund(req, deps, m[1]);
  }
  if ((m = path.match(/^\/api\/admin\/orders\/([^/]+)$/)) && method === "GET") {
    return api.adminGetOrder(req, deps, m[1]);
  }

  // Refunds
  if (path === "/api/admin/refunds" && method === "GET") {
    return api.adminListRefunds(req, deps);
  }

  // Categories
  if (path === "/api/admin/categories") {
    if (method === "GET") return api.adminListCategories(req, deps);
    if (method === "POST") return api.adminCreateCategory(req, deps);
  }
  if ((m = path.match(/^\/api\/admin\/categories\/([^/]+)\/image$/))) {
    if (method === "POST") return api.adminSetCategoryImage(req, deps, m[1]);
    if (method === "DELETE") return api.adminRemoveCategoryImage(req, deps, m[1]);
  }
  if ((m = path.match(/^\/api\/admin\/categories\/([^/]+)$/))) {
    if (method === "GET") return api.adminGetCategory(req, deps, m[1]);
    if (method === "PATCH") return api.adminUpdateCategory(req, deps, m[1]);
    if (method === "DELETE") return api.adminDeleteCategory(req, deps, m[1]);
  }

  // Products
  if (path === "/api/admin/products") {
    if (method === "GET") return api.adminListProducts(req, deps);
    if (method === "POST") return api.adminCreateProduct(req, deps);
  }
  if ((m = path.match(/^\/api\/admin\/products\/([^/]+)\/variants$/)) && method === "POST") {
    return api.adminAddVariant(req, deps, m[1]);
  }
  if ((m = path.match(/^\/api\/admin\/products\/([^/]+)\/images$/)) && method === "POST") {
    return api.adminUploadProductImage(req, deps, m[1]);
  }
  if ((m = path.match(/^\/api\/admin\/products\/([^/]+)$/))) {
    if (method === "GET") return api.adminGetProduct(req, deps, m[1]);
    if (method === "PATCH") return api.adminUpdateProduct(req, deps, m[1]);
    if (method === "DELETE") return api.adminDeleteProduct(req, deps, m[1]);
  }

  // Variants
  if ((m = path.match(/^\/api\/admin\/variants\/([^/]+)$/))) {
    if (method === "PATCH") return api.adminUpdateVariant(req, deps, m[1]);
    if (method === "DELETE") return api.adminDeleteVariant(req, deps, m[1]);
  }

  // Images
  if ((m = path.match(/^\/api\/admin\/images\/([^/]+)$/))) {
    if (method === "PATCH") return api.adminUpdateImage(req, deps, m[1]);
    if (method === "DELETE") return api.adminDeleteImage(req, deps, m[1]);
  }

  // Offers
  if (path === "/api/admin/offers") {
    if (method === "GET") return api.adminListOffers(req, deps);
    if (method === "POST") return api.adminCreateOffer(req, deps);
  }
  if ((m = path.match(/^\/api\/admin\/offers\/([^/]+)$/))) {
    if (method === "GET") return api.adminGetOffer(req, deps, m[1]);
    if (method === "PATCH") return api.adminUpdateOffer(req, deps, m[1]);
    if (method === "DELETE") return api.adminDeleteOffer(req, deps, m[1]);
  }

  // Coupons
  if (path === "/api/admin/coupons") {
    if (method === "GET") return api.adminListCoupons(req, deps);
    if (method === "POST") return api.adminCreateCoupon(req, deps);
  }
  if ((m = path.match(/^\/api\/admin\/coupons\/([^/]+)$/))) {
    if (method === "GET") return api.adminGetCoupon(req, deps, m[1]);
    if (method === "PATCH") return api.adminUpdateCoupon(req, deps, m[1]);
    if (method === "DELETE") return api.adminDeleteCoupon(req, deps, m[1]);
  }

  // Reviews
  if (path === "/api/admin/reviews") {
    if (method === "GET") return api.adminListReviewsH(req, deps);
  }
  if ((m = path.match(/^\/api\/admin\/reviews\/([^/]+)\/status$/)) && (method === "POST" || method === "PATCH")) {
    return api.adminUpdateReviewStatusH(req, deps, m[1]);
  }
  if ((m = path.match(/^\/api\/admin\/reviews\/([^/]+)$/))) {
    if (method === "GET") return api.adminGetReviewH(req, deps, m[1]);
    if (method === "PATCH") return api.adminUpdateReviewStatusH(req, deps, m[1]);
    if (method === "DELETE") return api.adminDeleteReviewH(req, deps, m[1]);
  }

  // Settings
  if (path === "/api/admin/settings/business") {
    if (method === "GET") return api.adminGetBusinessSettingsH(req, deps);
    if (method === "PATCH" || method === "POST") return api.adminUpdateBusinessSettingsH(req, deps);
  }

  return null;
}


