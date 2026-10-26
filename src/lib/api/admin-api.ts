import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  adminDashboard, changeOrderStatus, getAdminOrder, listAdminOrders, listRefundQueue, resolveRefund, setAdminNote, updateShipment,
} from "../admin/orders";
import {
  createCategory, createProduct, createVariant, deleteCategory, deleteProduct, deleteVariant, getCategory, getProduct, listCategories,
  listProducts, updateCategory, updateProduct, updateVariant,
} from "../admin/catalogue";
import {
  deleteProductImage, removeCategoryImage, removeObjects, setCategoryImage, updateProductImage, uploadProductImage,
} from "../admin/images";
import {
  createCoupon, createOffer, deleteCoupon, deleteOffer, getCoupon, getOffer, listCoupons, listOffers, updateCoupon, updateOffer,
} from "../admin/discounts";
import {
  categoryCreateSchema, categoryUpdateSchema, imageUpdateSchema, orderListQuery, orderNoteSchema, orderStatusSchema,
  productCreateSchema, productListQuery, productUpdateSchema, refundListQuery, refundResolveSchema, shipmentCreateSchema, shipmentUpdateSchema,
  variantCreateSchema, variantUpdateSchema,
} from "../admin/validation";
import { createOrderShipment, syncOrderTracking } from "../shipping/service";

import {
  couponCreateSchema, couponUpdateSchema, offerCreateSchema, offerUpdateSchema,
} from "../discounts/validation";
import {
  adminReviewQuerySchema, adminReviewStatusUpdateSchema,
} from "../reviews/validation";
import {
  adminDeleteReview, adminGetReview, adminListReviews, adminSetReviewStatus,
} from "../reviews/service";
import { optionalText, uuidSchema } from "../customers/validation";
import { profiles } from "../db/schema";
import { IMAGE_MAX_BYTES, type ObjectStorage } from "../storage/storage";
import { secured, type ApiDeps, type Ctx } from "./customer-api";
import { ApiError, errorBody, json, readJson, validate } from "./http";

type AdminCtx = Ctx & { adminId: string };

/**
 * Every admin endpoint goes through here:
 *   1. Mutating calls must carry an Origin that is one of our own sites (CSRF).
 *   2. Signed in (verified database session), else 401.
 *   3. profiles.role = 'admin' and not deleted, read from OUR database on every request, else 403.
 * Nothing about "being an admin" comes from the client.
 */
function adminSecured(deps: ApiDeps, req: Request, opts: { mutating: boolean }, fn: (c: AdminCtx) => Promise<Response>) {
  return secured(deps, req, { mutating: opts.mutating, requireOrigin: opts.mutating }, async (c) => {
    let role = c.user.role;
    if (!role) {
      const [p] = await c.db.select({ role: profiles.role, deletedAt: profiles.deletedAt }).from(profiles).where(eq(profiles.id, c.user.profileId));
      if (!p || p.deletedAt) return json(403, errorBody("FORBIDDEN", "Admin access required."));
      role = p.role;
    }
    if (role !== "admin") return json(403, errorBody("FORBIDDEN", "Admin access required."));
    return fn({ ...c, adminId: c.user.profileId });
  });
}

const query = <T>(schema: z.ZodType<T, any, any>, req: Request): T =>
  validate(schema, Object.fromEntries(new URL(req.url).searchParams));

const idOr404 = (id: string | undefined, code: string, what: string) => {
  if (!id || !uuidSchema.safeParse(id).success) throw new ApiError(404, code, `${what} not found.`);
  return id;
};
const orderId = (id?: string) => idOr404(id, "ORDER_NOT_FOUND", "Order");
const productId = (id?: string) => idOr404(id, "PRODUCT_NOT_FOUND", "Product");
const categoryId = (id?: string) => idOr404(id, "CATEGORY_NOT_FOUND", "Category");
const variantIdOf = (id?: string) => idOr404(id, "VARIANT_NOT_FOUND", "Variant");
const imageIdOf = (id?: string) => idOr404(id, "IMAGE_NOT_FOUND", "Image");
const offerIdOf = (id?: string) => idOr404(id, "OFFER_NOT_FOUND", "Offer");
const couponIdOf = (id?: string) => idOr404(id, "COUPON_NOT_FOUND", "Coupon");
const reviewIdOf = (id?: string) => idOr404(id, "REVIEW_NOT_FOUND", "Review");

const storageOf = (deps: ApiDeps): ObjectStorage => {
  if (!deps.storage) throw new ApiError(503, "STORAGE_NOT_CONFIGURED", "Image storage is not configured.");
  return deps.storage;
};
const base = (deps: ApiDeps) => ({ imageBaseUrl: deps.imageBaseUrl });

/* --------------------------------- Orders --------------------------------- */

export const adminDashboardH = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => json(200, await adminDashboard(db, deps.now?.())));

export const adminListOrders = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => {
    const q = query(orderListQuery, req);
    return json(200, await listAdminOrders(db, { ...q, attention: q.attention !== undefined }));
  });

export const adminGetOrder = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => json(200, await getAdminOrder(db, orderId(id))));

export const adminOrderStatus = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const b = validate(orderStatusSchema, await readJson(req));
    return json(200, await changeOrderStatus(db, adminId, orderId(id), b));
  });

export const adminOrderNote = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const b = validate(orderNoteSchema, await readJson(req));
    return json(200, await setAdminNote(db, adminId, orderId(id), b.note));
  });

export const adminOrderShipment = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const b = validate(shipmentUpdateSchema, await readJson(req));
    return json(200, await updateShipment(db, adminId, orderId(id), b));
  });

export const adminCreateOrderShipment = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const b = validate(shipmentCreateSchema, await readJson(req));
    const res = await createOrderShipment(db, adminId, orderId(id), {
      ...b,
      trackingUrl: b.trackingUrl ?? undefined,
    });
    return json(res.alreadyExists ? 200 : 201, res);
  });


export const adminSyncOrderTracking = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    return json(200, await syncOrderTracking(db, adminId, orderId(id)));
  });


export const adminListRefunds = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => json(200, await listRefundQueue(db, query(refundListQuery, req))));

export const adminResolveRefund = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const b = validate(refundResolveSchema, await readJson(req));
    return json(200, await resolveRefund(db, adminId, orderId(id), b));
  });

/* -------------------------------- Categories ------------------------------- */

export const adminListCategories = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => json(200, await listCategories(db, base(deps))));

export const adminCreateCategory = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const b = validate(categoryCreateSchema, await readJson(req));
    return json(201, await createCategory(db, adminId, b, base(deps)));
  });

export const adminGetCategory = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => json(200, await getCategory(db, categoryId(id), base(deps))));

export const adminUpdateCategory = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const b = validate(categoryUpdateSchema, await readJson(req));
    return json(200, await updateCategory(db, adminId, categoryId(id), b, base(deps)));
  });

export const adminDeleteCategory = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const keys = await deleteCategory(db, adminId, categoryId(id));
    if (deps.storage) await removeObjects(deps.storage, keys, deps.log);
    return json(200, { deleted: true });
  });

/* --------------------------------- Products -------------------------------- */

export const adminListProducts = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => {
    const q = query(productListQuery, req);
    return json(200, await listProducts(db, { ...q, active: q.active === undefined ? undefined : q.active === "true" }, base(deps)));
  });

export const adminCreateProduct = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const b = validate(productCreateSchema, await readJson(req));
    return json(201, await createProduct(db, adminId, b, base(deps)));
  });

export const adminGetProduct = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => json(200, await getProduct(db, productId(id), base(deps))));

export const adminUpdateProduct = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const b = validate(productUpdateSchema, await readJson(req));
    return json(200, await updateProduct(db, adminId, productId(id), b, base(deps)));
  });

export const adminDeleteProduct = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const keys = await deleteProduct(db, adminId, productId(id));
    if (deps.storage) await removeObjects(deps.storage, keys, deps.log);
    return json(200, { deleted: true });
  });

/* --------------------------------- Variants -------------------------------- */

export const adminAddVariant = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const b = validate(variantCreateSchema, await readJson(req));
    return json(201, await createVariant(db, adminId, productId(id), b));
  });

export const adminUpdateVariant = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const b = validate(variantUpdateSchema, await readJson(req));
    return json(200, await updateVariant(db, adminId, variantIdOf(id), b));
  });

export const adminDeleteVariant = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    await deleteVariant(db, adminId, variantIdOf(id));
    return json(200, { deleted: true });
  });

/* ---------------------------------- Images --------------------------------- */

/**
 * multipart/form-data with a `file` part (and optional `alt`, `primary=true` for products).
 * The size limit is checked from the declared length first, then again on the actual file.
 */
async function readUpload(req: Request) {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the image as multipart/form-data with a 'file' field.");
  }
  if (Number(req.headers.get("content-length") ?? 0) > IMAGE_MAX_BYTES + 512 * 1024) {
    throw new ApiError(413, "IMAGE_TOO_LARGE", `Images can be at most ${IMAGE_MAX_BYTES / 1024 / 1024} MB.`);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "INVALID_FORM", "Could not read the upload.");
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) throw new ApiError(422, "VALIDATION_FAILED", "Some fields are invalid.", { file: "Choose an image file" });
  if (file.size > IMAGE_MAX_BYTES) throw new ApiError(413, "IMAGE_TOO_LARGE", `Images can be at most ${IMAGE_MAX_BYTES / 1024 / 1024} MB.`);
  const alt = validate(z.object({ alt: optionalText(150) }), { alt: typeof form.get("alt") === "string" ? form.get("alt") : null }).alt;
  return { bytes: new Uint8Array(await file.arrayBuffer()), alt: alt as string | null, makePrimary: form.get("primary") === "true" };
}

export const adminUploadProductImage = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const storage = storageOf(deps);
    const f = await readUpload(req);
    return json(201, await uploadProductImage(db, storage, adminId, productId(id), f, { ...base(deps), log: deps.log }));
  });

export const adminUpdateImage = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const b = validate(imageUpdateSchema, await readJson(req));
    return json(200, await updateProductImage(db, adminId, imageIdOf(id), b, base(deps)));
  });

export const adminDeleteImage = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    await deleteProductImage(db, storageOf(deps), adminId, imageIdOf(id), deps.log);
    return json(200, { deleted: true });
  });

export const adminSetCategoryImage = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const storage = storageOf(deps);
    const f = await readUpload(req);
    return json(200, await setCategoryImage(db, storage, adminId, categoryId(id), f.bytes, { ...base(deps), log: deps.log }));
  });

export const adminRemoveCategoryImage = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    await removeCategoryImage(db, storageOf(deps), adminId, categoryId(id), deps.log);
    return json(200, { removed: true });
  });

/* --------------------------------- Offers --------------------------------- */

export const adminListOffers = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => {
    return json(200, { offers: await listOffers(db) });
  });

export const adminGetOffer = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => {
    return json(200, await getOffer(db, offerIdOf(id)));
  });

export const adminCreateOffer = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const body = validate(offerCreateSchema, await readJson(req));
    return json(201, await createOffer(db, adminId, body));
  });

export const adminUpdateOffer = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const body = validate(offerUpdateSchema, await readJson(req));
    return json(200, await updateOffer(db, adminId, offerIdOf(id), body));
  });

export const adminDeleteOffer = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    return json(200, await deleteOffer(db, adminId, offerIdOf(id)));
  });

/* -------------------------------- Coupons --------------------------------- */

export const adminListCoupons = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => {
    return json(200, { coupons: await listCoupons(db) });
  });

export const adminGetCoupon = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => {
    return json(200, await getCoupon(db, couponIdOf(id)));
  });

export const adminCreateCoupon = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const body = validate(couponCreateSchema, await readJson(req));
    return json(201, await createCoupon(db, adminId, body));
  });

export const adminUpdateCoupon = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const body = validate(couponUpdateSchema, await readJson(req));
    return json(200, await updateCoupon(db, adminId, couponIdOf(id), body));
  });

export const adminDeleteCoupon = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    return json(200, await deleteCoupon(db, adminId, couponIdOf(id)));
  });

/* -------------------------------- Reviews --------------------------------- */

export const adminListReviewsH = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => {
    const q = query(adminReviewQuerySchema, req);
    return json(200, await adminListReviews(db, q));
  });

export const adminGetReviewH = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => {
    return json(200, await adminGetReview(db, reviewIdOf(id)));
  });

export const adminUpdateReviewStatusH = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const body = validate(adminReviewStatusUpdateSchema, await readJson(req));
    return json(200, await adminSetReviewStatus(db, adminId, reviewIdOf(id), body.status, body.adminNote));
  });

export const adminDeleteReviewH = (req: Request, deps: ApiDeps, id: string) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    return json(200, await adminDeleteReview(db, adminId, reviewIdOf(id)));
  });

/* --------------------------- Settings / Business -------------------------- */

export const adminGetBusinessSettingsH = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: false }, async ({ db }) => {
    const { getBusinessSettings } = await import("../settings/service");
    return json(200, await getBusinessSettings(db));
  });

export const adminUpdateBusinessSettingsH = (req: Request, deps: ApiDeps) =>
  adminSecured(deps, req, { mutating: true }, async ({ db, adminId }) => {
    const { updateBusinessSettings } = await import("../settings/service");
    const { updateBusinessSettingsSchema } = await import("../settings/validation");
    const body = validate(updateBusinessSettingsSchema, await readJson(req));
    return json(200, await updateBusinessSettings(db, adminId, body));
  });



