import test from "node:test";
import assert from "node:assert/strict";
import { notFound } from "../middleware/errorHandler.js";
import { requireRole } from "../middleware/auth.js";
import { allowConfiguredOrigin } from "../middleware/security.js";
import { env } from "../config/env.js";
import { calculateBookingCharges } from "../utils/pricing.js";
import { ApiError } from "../utils/apiError.js";
import {
  productRatingSchema,
  productViewsSchema,
  inactivityPolicySchema,
  inactivityPreferenceSchema,
  platformFeeSchema,
  shopRegistrationSchema,
  loginSchema,
  buyerRegistrationSchema,
  termsAcceptanceSchema,
  adminAccessGrantSchema,
  bookingSchema,
  orderStatusSchema,
  platformFeeSettlementRequestSchema
} from "../utils/validation.js";
import {
  PLATFORM_FEE_ELIGIBLE_ORDER_STATUSES,
  summarizePlatformFeeSettlement
} from "../utils/platformFeeSettlement.js";
import { rankProducts } from "../utils/productRanking.js";
import { subtractMonths } from "../services/inactiveAccountCleanupService.js";
import { isPrimaryAdmin } from "../utils/serializers.js";
import { hasAcceptedCurrentTerms, TERMS_VERSION } from "../utils/terms.js";
import {
  canBuyerCancelOrder,
  canTransitionOrderStatus,
  nextOrderStatus,
  normalizeOrderStatus
} from "../utils/orderLifecycle.js";

test("API routes mounted under /api return a JSON 404 error", () => {
  let receivedError;
  notFound({ path: "/missing", originalUrl: "/api/missing?source=test" }, {}, error => {
    receivedError = error;
  });
  assert.ok(receivedError instanceof ApiError);
  assert.equal(receivedError.status, 404);
  assert.equal(receivedError.code, "ROUTE_NOT_FOUND");
});

test("admin authorization rejects a signed-in non-admin user", () => {
  let receivedError;
  requireRole("admin")({ user: { role: "shop_owner" } }, {}, error => {
    receivedError = error;
  });
  assert.ok(receivedError instanceof ApiError);
  assert.equal(receivedError.status, 403);
});

test("API CORS preflight allows credentialed requests only from the configured app origin", () => {
  const headers = {};
  const configuredOrigin = new URL(env.appOrigin).origin;
  const req = {
    method: "OPTIONS",
    get: name => ({
      origin: configuredOrigin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type"
    })[name.toLowerCase()]
  };
  const res = {
    setHeader: (name, value) => { headers[name] = value; },
    vary: name => { headers.Vary = name; },
    sendStatus: status => { headers.status = status; }
  };
  let continued = false;

  allowConfiguredOrigin(req, res, () => { continued = true; });

  assert.equal(continued, false);
  assert.equal(headers.status, 204);
  assert.equal(headers["Access-Control-Allow-Origin"], configuredOrigin);
  assert.equal(headers["Access-Control-Allow-Credentials"], "true");
  assert.equal(headers["Access-Control-Allow-Headers"], "Content-Type");
});

test("API CORS preflight does not allow unconfigured origins or request headers", () => {
  const deniedOriginHeaders = {};
  const req = {
    method: "OPTIONS",
    get: name => ({
      origin: "http://untrusted.example",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type"
    })[name.toLowerCase()]
  };
  const makeResponse = headers => ({
    setHeader: (name, value) => { headers[name] = value; },
    vary: name => { headers.Vary = name; },
    sendStatus: status => { headers.status = status; }
  });
  let continued = false;
  allowConfiguredOrigin(req, makeResponse(deniedOriginHeaders), () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(deniedOriginHeaders["Access-Control-Allow-Origin"], undefined);

  const deniedHeaderHeaders = {};
  req.get = name => ({
    origin: new URL(env.appOrigin).origin,
    "access-control-request-method": "POST",
    "access-control-request-headers": "authorization"
  })[name.toLowerCase()];
  allowConfiguredOrigin(req, makeResponse(deniedHeaderHeaders), () => { continued = true; });
  assert.equal(deniedHeaderHeaders.status, 403);
});

test("admin dashboard visibility requires the configured admin role and identity", () => {
  const user = { role: "admin", countryCode: "+91", phone: "5550001234" };
  assert.equal(isPrimaryAdmin(user, "+91", "(555) 000-1234"), true);
  assert.equal(isPrimaryAdmin({ ...user, role: "shop_owner" }, "+91", "5550001234"), false);
  assert.equal(isPrimaryAdmin({ ...user, phone: "5550001235" }, "+91", "5550001234"), false);
});

test("booking charges apply the stored GST rate and platform fee", () => {
  assert.deepEqual(calculateBookingCharges({
    price: 100,
    gstEnabled: true,
    gstRate: 18
  }, 2), {
    subtotal: 200,
    gstRate: 18,
    gst: 36,
    platformFee: 12,
    amount: 248
  });
});

test("booking charges exclude GST when the supplier has GST disabled", () => {
  assert.deepEqual(calculateBookingCharges({
    price: 99.99,
    gstEnabled: false,
    gstRate: 28
  }, 3), {
    subtotal: 299.97,
    gstRate: 0,
    gst: 0,
    platformFee: 12,
    amount: 311.97
  });
});

test("booking charges add the same fixed platform fee regardless of quantity", () => {
  const charges = calculateBookingCharges({
    price: 100,
    gstEnabled: false,
    gstRate: 18
  }, 2, 12);
  assert.equal(charges.platformFee, 12);
  assert.equal(charges.amount, 212);
});

test("platform fee settings accept fixed rupee amounts in the configured range", () => {
  for (const platformFee of [0, 12, 125.5, 1000000]) {
    assert.equal(platformFeeSchema.safeParse({ platformFee }).success, true);
  }
  assert.equal(platformFeeSchema.safeParse({ platformFee: -0.01 }).success, false);
  assert.equal(platformFeeSchema.safeParse({ platformFee: 1000000.01 }).success, false);
});

test("platform fee settlements sum eligible order fees and pending requests", () => {
  assert.deepEqual(summarizePlatformFeeSettlement(
    { amount: 24.25, orderCount: 2 },
    { amount: 12.5, orderCount: 1, settlementCount: 1 }
  ), {
    amountDue: 36.75,
    requestableAmount: 24.25,
    requestableOrderCount: 2,
    pendingAmount: 12.5,
    pendingOrderCount: 1,
    pendingSettlementCount: 1
  });
  assert.deepEqual(PLATFORM_FEE_ELIGIBLE_ORDER_STATUSES, [
    "Order placed at site",
    "Completed",
    "Delivered"
  ]);
});

test("shop fee settlement requests accept only supported manual payment methods", () => {
  for (const paymentMethod of ["upi_transfer", "cash_at_office", "admin_call"]) {
    assert.equal(platformFeeSettlementRequestSchema.safeParse({ paymentMethod }).success, true);
  }
  assert.equal(platformFeeSettlementRequestSchema.safeParse({ paymentMethod: "online_gateway" }).success, false);
});

test("booking input persists only the supported cash-on-delivery payment options", () => {
  const booking = {
    productId: "507f1f77bcf86cd799439011",
    buyerName: "Buyer Name",
    buyerPhone: "+91 9876543210",
    paymentMethod: "POD",
    projectSite: "Site One",
    deliveryDate: "2026-12-01",
    deliveryAddress: "1 Main Road",
    deliveryCity: "Bengaluru",
    deliveryState: "Karnataka",
    deliveryPin: "560001",
    quantity: 2,
    deliveryNotes: ""
  };
  assert.equal(bookingSchema.parse(booking).paymentMethod, "POD");
  assert.equal(bookingSchema.parse({ ...booking, paymentMethod: undefined }).paymentMethod, "COD");
  assert.throws(() => bookingSchema.parse({ ...booking, paymentMethod: "ONLINE" }));
});

test("order lifecycle only allows the assigned role to advance the next stage", () => {
  assert.equal(nextOrderStatus("Pending", "shop_owner"), "Accepted");
  assert.equal(nextOrderStatus("Accepted", "shop_owner"), "Packing");
  assert.equal(nextOrderStatus("Packing", "shop_owner"), "Ready for delivery");
  assert.equal(nextOrderStatus("Ready for delivery", "delivery"), "Out for delivery");
  assert.equal(nextOrderStatus("Out for delivery", "delivery"), "Order placed at site");
  assert.equal(nextOrderStatus("Order placed at site", "shop_owner"), "Completed");
  assert.equal(canTransitionOrderStatus("Accepted", "Packing", "delivery"), false);
  assert.equal(canTransitionOrderStatus("Pending", "Declined", "shop_owner"), true);
  assert.equal(canTransitionOrderStatus("Pending", "Declined", "delivery"), false);
  assert.equal(canTransitionOrderStatus("Out for delivery", "Order placed at site", "delivery"), true);
  assert.equal(canBuyerCancelOrder("Packing"), true);
  assert.equal(canBuyerCancelOrder("Out for delivery"), false);
  assert.equal(canTransitionOrderStatus("Ready for delivery", "Cancelled", "buyer"), true);
  assert.equal(normalizeOrderStatus("Processing"), "Accepted");
  assert.equal(normalizeOrderStatus("Delivered"), "Order placed at site");
  assert.equal(orderStatusSchema.parse({ status: "Ready for delivery" }).status, "Ready for delivery");
  assert.equal(orderStatusSchema.parse({ status: "Order placed at site" }).status, "Order placed at site");
  assert.throws(() => orderStatusSchema.parse({ status: "Paid" }));
});

test("personal inactivity deletion preferences can inherit, disable, or override the admin policy", () => {
  assert.equal(inactivityPreferenceSchema.parse({
    useAdminPolicy: true,
    inactiveAccountMonths: null
  }).useAdminPolicy, true);
  assert.equal(inactivityPreferenceSchema.parse({
    useAdminPolicy: false,
    inactiveAccountMonths: 6
  }).inactiveAccountMonths, 6);
  assert.equal(inactivityPreferenceSchema.parse({
    useAdminPolicy: false,
    inactiveAccountMonths: null
  }).inactiveAccountMonths, null);
  assert.equal(inactivityPreferenceSchema.safeParse({
    useAdminPolicy: true,
    inactiveAccountMonths: 6
  }).success, false);
});

test("shop registration requires a valid GSTIN when GST is enabled", () => {
  const shop = {
    shopName: "Cement Hub",
    ownerName: "Shop Owner",
    shopEmail: "owner@example.test",
    shopPhone: "+91 9876543210",
    supplierCategory: "Building materials",
    gstEnabled: true,
    gstin: "invalid",
    shopAddress: "12 Main Road",
    shopCity: "Pune",
    shopState: "Maharashtra",
    shopPin: "411001"
  };

  const result = shopRegistrationSchema.safeParse(shop);
  assert.equal(result.success, false);
  assert.deepEqual(result.error.issues[0].path, ["gstin"]);
});

test("shop registration attaches to an approved owner instead of creating a password", () => {
  const shop = {
    shopName: "Cement Hub",
    ownerName: "Shop Owner",
    shopEmail: "owner@example.test",
    shopPhone: "+91 9876543210",
    supplierCategory: "Building materials",
    gstEnabled: false,
    gstin: "",
    shopAddress: "12 Main Road",
    shopCity: "Pune",
    shopState: "Maharashtra",
    shopPin: "411001"
  };
  assert.equal(shopRegistrationSchema.safeParse(shop).success, true);
  assert.equal(shopRegistrationSchema.safeParse({ ...shop, ownerPassword: "StrongPass1" }).success, false);
});

test("login identifies an account by phone without accepting a role selector", () => {
  const credentials = { countryCode: "+91", phone: "9876543210", password: "StrongPass1" };
  assert.equal(loginSchema.safeParse(credentials).success, true);
  assert.equal(loginSchema.safeParse({ ...credentials, role: "shop_owner" }).success, false);
});

test("buyer registration requires a name and a strong password", () => {
  assert.equal(buyerRegistrationSchema.safeParse({
    name: "Buyer Name",
    countryCode: "+91",
    phone: "9876543210",
    password: "StrongPass1",
    termsAccepted: true
  }).success, true);
  assert.equal(buyerRegistrationSchema.safeParse({
    countryCode: "+91",
    phone: "9876543210",
    password: "StrongPass1",
    termsAccepted: false
  }).success, false);
});

test("terms acceptance is current-version-only and must be explicitly true", () => {
  assert.equal(hasAcceptedCurrentTerms({ termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION }), true);
  assert.equal(hasAcceptedCurrentTerms({ termsAcceptedAt: new Date(), termsVersion: "older-version" }), false);
  assert.equal(hasAcceptedCurrentTerms({ termsAcceptedAt: null, termsVersion: TERMS_VERSION }), false);
  assert.equal(termsAcceptanceSchema.safeParse({ accepted: true }).success, true);
  assert.equal(termsAcceptanceSchema.safeParse({ accepted: false }).success, false);
});

test("admin access grants require an active-shop assignment only for delivery users", () => {
  const shopId = "65b04e241b48e32142c1a345";
  assert.equal(adminAccessGrantSchema.safeParse({ role: "shop_owner" }).success, true);
  assert.equal(adminAccessGrantSchema.safeParse({ role: "delivery", shopId }).success, true);
  assert.equal(adminAccessGrantSchema.safeParse({ role: "delivery" }).success, false);
  assert.equal(adminAccessGrantSchema.safeParse({ role: "shop_owner", shopId }).success, false);
});

test("product ratings require a valid delivered-booking reference and a 1-5 score", () => {
  const valid = productRatingSchema.safeParse({
    bookingNumber: "BK-12345678-A1B2",
    buyerPhone: "+91 9876543210",
    score: 5
  });
  const invalid = productRatingSchema.safeParse({
    bookingNumber: "not-a-booking",
    buyerPhone: "+91 9876543210",
    score: 6
  });

  assert.equal(valid.success, true);
  assert.equal(invalid.success, false);
});

test("product view batches deduplicate repeated product ids", () => {
  const productId = "65b04e241b48e32142c1a345";
  assert.deepEqual(productViewsSchema.parse({ productIds: [productId, productId] }), {
    productIds: [productId]
  });
});

test("product ranking blends Bayesian ratings, orders, views, and freshness", () => {
  const now = new Date("2026-01-30T00:00:00.000Z");
  const products = rankProducts([
    {
      id: "new",
      averageRating: 0,
      ratingCount: 0,
      totalOrders: 0,
      views: 0,
      createdAt: "2026-01-29T00:00:00.000Z"
    },
    {
      id: "established",
      averageRating: 4.8,
      ratingCount: 20,
      totalOrders: 40,
      views: 120,
      createdAt: "2025-12-20T00:00:00.000Z"
    }
  ], now);

  assert.equal(products[0].id, "established");
  assert.ok(products[0].recommendationScore > products[1].recommendationScore);
});

test("inactivity policy accepts only the supported retention periods or off", () => {
  for (const inactiveAccountMonths of [null, 2, 6, 12, 18]) {
    assert.equal(inactivityPolicySchema.safeParse({ inactiveAccountMonths }).success, true);
  }
  assert.equal(inactivityPolicySchema.safeParse({ inactiveAccountMonths: 3 }).success, false);
});

test("subtracting months clamps to the last valid UTC day", () => {
  assert.equal(
    subtractMonths(new Date("2024-03-31T12:00:00.000Z"), 1).toISOString(),
    "2024-02-29T12:00:00.000Z"
  );
  assert.equal(
    subtractMonths(new Date("2025-01-31T00:00:00.000Z"), 2).toISOString(),
    "2024-11-30T00:00:00.000Z"
  );
});
