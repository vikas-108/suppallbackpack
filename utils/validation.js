import { z } from "zod";
import { ORDER_STATUSES } from "./orderLifecycle.js";

export const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry"
];

export const constructionCategories = [
  "Cement & concrete", "Steel & metal", "Bricks & blocks", "Sand & aggregates",
  "Electrical", "Plumbing", "Paints & finishes", "Tiles & flooring",
  "Tools & safety", "Timber & doors", "Roofing", "Waterproofing"
];

export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters.")
  .max(64, "Password must be 64 characters or fewer.")
  .regex(/[A-Za-z]/, "Password must include a letter.")
  .regex(/\d/, "Password must include a number.");

const shopFields = z.object({
  shopName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  shopEmail: z.string().trim().email().max(254),
  shopPhone: z.string().trim().min(7).max(24),
  supplierCategory: z.enum([
    "Building materials", "Cement & concrete", "Steel & metal", "Bricks & blocks",
    "Sand & aggregates", "Electrical", "Plumbing", "Paints & finishes",
    "Tiles & flooring", "Tools & safety", "Timber & doors", "Roofing",
    "Waterproofing", "Multiple categories"
  ]),
  gstEnabled: z.boolean(),
  gstin: z.string().trim().max(15).default(""),
  shopAddress: z.string().trim().min(5).max(240),
  shopCity: z.string().trim().min(2).max(100),
  shopState: z.enum(indianStates),
  shopPin: z.string().regex(/^\d{6}$/)
}).strict();

function refineShopGstin(data, context) {
  if (data.gstEnabled && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(data.gstin.toUpperCase())) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["gstin"], message: "Enter a valid 15-character GSTIN." });
  }
}

export const shopRegistrationSchema = shopFields.superRefine(refineShopGstin);

export const shopUpdateSchema = shopFields.superRefine(refineShopGstin);

export const deliveryUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  countryCode: z.enum(["+91", "+1", "+44", "+61", "+65", "+971"]),
  phone: z.string().trim().min(7).max(24),
  password: passwordSchema
}).strict();
export const termsAcceptanceSchema = z.object({
  accepted: z.literal(true, "You must accept the Terms & Conditions.")
}).strict();

export const loginSchema = z.object({
  countryCode: z.enum(["+91", "+1", "+44", "+61", "+65", "+971"]),
  phone: z.string().trim().min(7).max(24),
  password: z.string().min(1).max(64)
}).strict();
export const buyerRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  countryCode: z.enum(["+91", "+1", "+44", "+61", "+65", "+971"]),
  phone: z.string().trim().min(7).max(24),
  password: passwordSchema,
  termsAccepted: z.literal(true, "You must accept the Terms & Conditions.")
}).strict();
export const adminAccessGrantSchema = z.object({
  role: z.enum(["shop_owner", "delivery"]),
  shopId: z.string().regex(/^[a-f\d]{24}$/i).optional()
}).strict().superRefine((data, context) => {
  if (data.role === "delivery" && !data.shopId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["shopId"], message: "Choose a shop for delivery access." });
  }
  if (data.role === "shop_owner" && data.shopId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["shopId"], message: "Shop-owner access does not use a shop assignment." });
  }
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(140),
  category: z.enum(constructionCategories),
  unit: z.string().trim().min(1).max(40),
  price: z.number().finite().positive().max(100000000),
  stock: z.number().int().min(0).max(100000000),
  gstRate: z.number().refine(value => [0, 5, 12, 18, 28].includes(value), "Choose a supported GST rate."),
  description: z.string().trim().max(240).default(""),
  imageUrl: z.string().url().max(2048).or(z.literal("")).default(""),
  imagePublicId: z.string().max(240).default("")
}).strict();

export const productUpdateSchema = productSchema.partial().strict();

export const bookingSchema = z.object({
  productId: z.string().regex(/^[a-f\d]{24}$/i),
  buyerName: z.string().trim().min(2).max(120),
  buyerPhone: z.string().trim().min(7).max(24),
  paymentMethod: z.enum(["COD", "POD"]).default("COD"),
  projectSite: z.string().trim().min(2).max(160),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliveryAddress: z.string().trim().min(5).max(240),
  deliveryCity: z.string().trim().min(2).max(100),
  deliveryState: z.enum(indianStates),
  deliveryPin: z.string().regex(/^\d{6}$/),
  quantity: z.number().int().min(1).max(1000000),
  deliveryNotes: z.string().trim().max(240).default("")
}).strict();

export const bookingStatusSchema = z.object({
  status: z.enum(["Confirmed", "Declined"])
}).strict();

export const productRatingSchema = z.object({
  bookingNumber: z.string().trim().regex(/^BK-\d{8}-[A-F\d]{4}$/i, "Enter a valid booking reference."),
  buyerPhone: z.string().trim().min(7).max(24).regex(/^\+?[\d\s()-]+$/, "Enter the phone used for this order."),
  score: z.number().int().min(1).max(5)
}).strict();

export const productViewsSchema = z.object({
  productIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(50)
}).strict().transform(({ productIds }) => ({ productIds: [...new Set(productIds)] }));

export const orderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES)
}).strict();
export const inactivityPreferenceSchema = z.object({
  useAdminPolicy: z.boolean(),
  inactiveAccountMonths: z.union([z.literal(2), z.literal(6), z.literal(12), z.literal(18)]).nullable()
}).strict().superRefine((data, context) => {
  if (data.useAdminPolicy && data.inactiveAccountMonths !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["inactiveAccountMonths"], message: "Use the administrator policy or choose a personal period." });
  }
});

export const addressSchema = z.object({
  business: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(24),
  country: z.literal("India"),
  street: z.string().trim().min(5).max(240),
  locality: z.string().trim().min(2).max(120),
  landmark: z.string().trim().max(160).default(""),
  city: z.string().trim().min(2).max(100),
  district: z.string().trim().min(2).max(100),
  state: z.enum(indianStates),
  pin: z.string().regex(/^\d{6}$/),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null)
}).strict();

export const activeStatusSchema = z.object({ isActive: z.boolean() }).strict();
export const inactivityPolicySchema = z.object({
  inactiveAccountMonths: z.union([z.literal(2), z.literal(6), z.literal(12), z.literal(18)]).nullable()
}).strict();
export const platformFeeSchema = z.object({
  platformFee: z.number().finite().min(0).max(1000000)
}).strict();
export const platformFeeSettlementRequestSchema = z.object({
  paymentMethod: z.enum(["upi_transfer", "cash_at_office", "admin_call"])
}).strict();
export const publicationSchema = z.object({ published: z.boolean() }).strict();
