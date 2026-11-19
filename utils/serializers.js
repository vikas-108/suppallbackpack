import { formatInternationalPhone } from "./phone.js";
import { env } from "../config/env.js";
import { normalizeOrderStatus } from "./orderLifecycle.js";
import { hasAcceptedCurrentTerms } from "./terms.js";

export function isPrimaryAdmin(user, countryCode = env.adminCountryCode, phone = env.adminPhone) {
  const configuredPhone = String(phone).replace(/\D/g, "");
  return user.role === "admin" &&
    Boolean(countryCode && configuredPhone) &&
    user.countryCode === countryCode &&
    user.phone === configuredPhone;
}

export function serializeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email || "",
    countryCode: user.countryCode,
    phone: user.phone,
    role: user.role,
    termsAccepted: hasAcceptedCurrentTerms(user),
    shopId: user.shopId ? String(user.shopId) : null,
    isActive: user.isActive,
    canAccessAdminDashboard: isPrimaryAdmin(user)
  };
}

export function serializeShop(shop) {
  return {
    id: String(shop._id),
    shopName: shop.name,
    ownerName: shop.ownerName,
    shopEmail: shop.email,
    shopPhone: shop.phone,
    supplierCategory: shop.supplierCategory,
    gstEnabled: shop.gstEnabled,
    gstin: shop.gstin,
    shopAddress: shop.address,
    shopCity: shop.city,
    shopState: shop.state,
    shopPin: shop.pin,
    isActive: shop.isActive
  };
}

export function serializeProduct(product) {
  const shop = product.shopId && typeof product.shopId === "object" ? product.shopId : null;
  const ratingCount = Number(product.ratingCount || 0);
  const ratingTotal = Number(product.ratingTotal || 0);
  const averageRating = ratingCount ? ratingTotal / ratingCount : 0;
  return {
    id: String(product._id),
    name: product.name,
    supplier: shop?.name || product.supplier || "",
    category: product.category,
    price: product.price,
    unit: product.unit,
    stock: product.stock,
    gstRate: product.gstRate,
    gstEnabled: product.gstEnabled,
    description: product.description,
    image: product.imageUrl,
    imagePublicId: product.imagePublicId,
    emoji: product.emoji,
    color: product.color,
    rating: ratingCount ? averageRating.toFixed(1) : "New",
    averageRating,
    ratingCount,
    totalOrders: Number(product.totalOrders || 0),
    views: Number(product.views || 0),
    createdAt: product.createdAt?.toISOString?.() || "",
    published: product.published,
    isActive: product.isActive
  };
}

export function serializeDeliveryUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    countryCode: user.countryCode,
    phone: user.phone,
    phoneDisplay: formatInternationalPhone(user.countryCode, user.phone),
    isActive: user.isActive
  };
}

export function serializeBooking(booking) {
  return {
    id: booking.bookingNumber,
    paymentMethod: booking.paymentMethod || "COD",
    customer: booking.buyerName,
    initials: booking.buyerName.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join(""),
    phone: booking.buyerPhone,
    site: booking.projectSite,
    address: booking.deliveryAddress,
    city: booking.deliveryCity,
    state: booking.deliveryState,
    pin: booking.deliveryPin,
    deliveryNotes: booking.deliveryNotes,
    item: `${booking.productName} · ${booking.quantity} ${booking.productUnit}`,
    date: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(booking.deliveryDate),
    quantity: booking.quantity,
    productId: String(booking.productId),
    subtotal: booking.subtotal,
    gst: booking.gst,
    gstRate: booking.gstRate,
    gstEnabled: booking.gstEnabled,
    platformFee: booking.platformFee,
    amount: booking.amount,
    status: booking.status
  };
}

export function serializeOrder(order) {
  return {
    id: order.orderNumber,
    shopId: String(order.shopId?._id || order.shopId),
    customer: order.customer,
    supplier: order.supplier || "BuildSupply supplier",
    initials: order.customer.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join(""),
    phone: order.phone.replace(/\D/g, ""),
    site: order.site,
    address: order.address,
    city: order.city,
    state: order.state,
    pin: order.pin,
    date: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(order.date),
    dateISO: order.date.toISOString(),
    item: order.item,
    quantity: order.quantity,
    subtotal: order.subtotal,
    gst: order.gst,
    gstRate: order.gstRate,
    platformFee: order.platformFee,
    amount: order.amount,
    status: normalizeOrderStatus(order.status),
    paymentMethod: order.paymentMethod || "COD",
    statusHistory: order.statusHistory?.length
      ? order.statusHistory.map(entry => ({
        status: normalizeOrderStatus(entry.status),
        updatedByRole: entry.updatedByRole,
        updatedAt: entry.updatedAt.toISOString()
      }))
      : [{
        status: normalizeOrderStatus(order.status),
        updatedByRole: "system",
        updatedAt: (order.updatedAt || order.date).toISOString()
      }]
  };
}

export function serializePlatformFeeSettlement(settlement) {
  const shop = settlement.shopId && typeof settlement.shopId === "object" && settlement.shopId.name
    ? settlement.shopId
    : null;
  const owner = shop?.ownerId && typeof shop.ownerId === "object" ? shop.ownerId : null;
  return {
    id: String(settlement._id),
    shopId: String(shop?._id || settlement.shopId),
    shopName: shop?.name || "",
    ownerName: owner?.name || shop?.ownerName || "",
    ownerCountryCode: owner?.countryCode || "",
    ownerPhone: owner?.phone || shop?.phone || "",
    amount: settlement.amount,
    orderCount: settlement.orderCount,
    paymentMethod: settlement.paymentMethod,
    status: settlement.status,
    requestedAt: settlement.createdAt?.toISOString?.() || "",
    confirmedAt: settlement.confirmedAt?.toISOString?.() || null
  };
}

export function serializeAddress(address) {
  if (!address) return null;
  return {
    business: address.business,
    phone: address.phone,
    country: address.country,
    street: address.street,
    locality: address.locality,
    landmark: address.landmark,
    city: address.city,
    district: address.district,
    state: address.state,
    pin: address.pin,
    latitude: address.latitude,
    longitude: address.longitude
  };
}
