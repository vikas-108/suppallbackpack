import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import ProductRating from "../models/ProductRating.js";
import { getOwnedShop } from "./shopService.js";
import { deleteProductImage } from "./cloudinaryService.js";
import { ApiError } from "../utils/apiError.js";
import { serializeProduct } from "../utils/serializers.js";
import { emitToAll } from "./realtimeService.js";
import { rankProducts } from "../utils/productRanking.js";

const categoryVisuals = {
  "Cement & concrete": ["🧱", "#e9e5dc"],
  "Steel & metal": ["🏗️", "#e4e9e9"],
  "Bricks & blocks": ["🧱", "#f1e2d9"],
  "Sand & aggregates": ["⛏️", "#eee8d8"],
  Electrical: ["🔌", "#e7edf0"],
  Plumbing: ["🚰", "#e2edf0"],
  "Paints & finishes": ["🎨", "#e8eadf"],
  "Tiles & flooring": ["▦", "#e8e7e2"],
  "Tools & safety": ["🦺", "#f3ecd5"],
  "Timber & doors": ["🪵", "#eee5d9"],
  Roofing: ["🏠", "#e5e9e9"],
  Waterproofing: ["🪣", "#e1ece6"]
};

let legacyOrderCountsPromise;

function getLegacyOrderCounts() {
  if (!legacyOrderCountsPromise) {
    legacyOrderCountsPromise = Order.aggregate([
      { $match: { productId: { $exists: false } } },
      {
        $lookup: {
          from: Booking.collection.name,
          localField: "bookingId",
          foreignField: "_id",
          as: "booking"
        }
      },
      { $unwind: "$booking" },
      { $group: { _id: "$booking.productId", count: { $sum: 1 } } }
    ]).then(counts => new Map(counts.map(item => [String(item._id), item.count])))
      .catch(error => {
        legacyOrderCountsPromise = null;
        throw error;
      });
  }
  return legacyOrderCountsPromise;
}

function validateImageOwnership(shopId, imageUrl, publicId) {
  if (!imageUrl && !publicId) return;
  let url;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new ApiError(400, "Choose a valid Cloudinary product image.", "INVALID_PRODUCT_IMAGE");
  }
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" ||
      !publicId.startsWith(`buildsupply/products/${shopId}/`)) {
    throw new ApiError(400, "Product images must be uploaded to this shop's Cloudinary folder.", "INVALID_PRODUCT_IMAGE");
  }
}

function productFields(data, shop, includeImage = true) {
  const [emoji, color] = categoryVisuals[data.category];
  const fields = {
    name: data.name,
    category: data.category,
    unit: data.unit,
    price: data.price,
    stock: data.stock,
    gstRate: data.gstRate,
    gstEnabled: shop.gstEnabled,
    description: data.description ?? "",
    emoji,
    color
  };
  if (includeImage) {
    fields.imageUrl = data.imageUrl ?? "";
    fields.imagePublicId = data.imagePublicId ?? "";
  }
  validateImageOwnership(shop._id, fields.imageUrl || "", fields.imagePublicId || "");
  return fields;
}

export async function listPublicProducts() {
  const [products, legacyCounts] = await Promise.all([
    Product.find({ published: true, isActive: true })
      .populate({ path: "shopId", match: { isActive: true }, select: "name" })
      .sort({ createdAt: -1 }),
    getLegacyOrderCounts()
  ]);
  return rankProducts(products.filter(product => product.shopId).map(product => {
    const serialized = serializeProduct(product);
    return {
      ...serialized,
      totalOrders: serialized.totalOrders + (legacyCounts.get(serialized.id) || 0)
    };
  }));
}

export async function recordProductViews(productIds) {
  await Product.updateMany(
    { _id: { $in: productIds }, published: true, isActive: true },
    { $inc: { views: 1 } }
  );
  const products = await Product.find({
    _id: { $in: productIds },
    published: true,
    isActive: true
  }).select("_id views");
  return products.map(product => ({ id: String(product._id), views: product.views }));
}

function normalizePhone(phone) {
  return phone.replace(/\D/g, "");
}

export async function submitProductRating(productId, data) {
  if (!mongoose.isValidObjectId(productId)) {
    throw new ApiError(404, "Product not found.", "PRODUCT_NOT_FOUND");
  }

  const session = await mongoose.startSession();
  let updatedProduct;
  try {
    await session.withTransaction(async () => {
      const product = await Product.findOne({
        _id: productId,
        published: true,
        isActive: true
      }).session(session);
      if (!product) throw new ApiError(404, "Product not found.", "PRODUCT_NOT_FOUND");

      const booking = await Booking.findOne({
        bookingNumber: data.bookingNumber.toUpperCase(),
        productId: product._id,
        status: "Completed"
      }).session(session);
      if (!booking || normalizePhone(booking.buyerPhone) !== normalizePhone(data.buyerPhone)) {
        throw new ApiError(404, "No delivered order matched that booking reference and phone.", "DELIVERED_ORDER_NOT_FOUND");
      }

      const deliveredOrder = await Order.findOne({
        bookingId: booking._id,
        status: { $in: ["Order placed at site", "Delivered", "Completed"] }
      }).session(session);
      if (!deliveredOrder) {
        throw new ApiError(409, "Ratings are available after the order is placed at the project site.", "ORDER_NOT_DELIVERED");
      }

      await ProductRating.create([{
        productId: product._id,
        shopId: product.shopId,
        bookingId: booking._id,
        score: data.score
      }], { session });
      updatedProduct = await Product.findByIdAndUpdate(
        product._id,
        { $inc: { ratingTotal: data.score, ratingCount: 1 } },
        { new: true, session }
      );
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "This delivered order has already rated the product.", "ORDER_ALREADY_RATED");
    }
    throw error;
  } finally {
    await session.endSession();
  }

  await updatedProduct.populate("shopId", "name");
  emitToAll("catalog.updated", { productId: String(updatedProduct._id) });
  return serializeProduct(updatedProduct);
}

export async function listShopProducts(userId) {
  const shop = await getOwnedShop(userId);
  const products = await Product.find({ shopId: shop._id, isActive: true })
    .populate("shopId", "name")
    .sort({ createdAt: -1 });
  return products.map(serializeProduct);
}

export async function createProduct(userId, data) {
  const shop = await getOwnedShop(userId);
  if (!shop.isActive) throw new ApiError(409, "Reactivate your shop before publishing products.", "SHOP_INACTIVE");
  const product = await Product.create({
    shopId: shop._id,
    ...productFields(data, shop)
  });
  await product.populate("shopId", "name");
  const serialized = serializeProduct(product);
  emitToAll("catalog.updated", { productId: serialized.id });
  return serialized;
}

export async function updateProduct(userId, productId, data) {
  if (!mongoose.isValidObjectId(productId)) throw new ApiError(400, "Invalid product.", "INVALID_ID");
  const shop = await getOwnedShop(userId);
  const product = await Product.findOne({ _id: productId, shopId: shop._id, isActive: true });
  if (!product) throw new ApiError(404, "Product not found.", "PRODUCT_NOT_FOUND");
  const oldPublicId = product.imagePublicId;
  const update = { ...data };
  if (data.category) {
    const [emoji, color] = categoryVisuals[data.category];
    update.emoji = emoji;
    update.color = color;
  }
  if (data.gstRate !== undefined || data.category !== undefined || data.price !== undefined ||
      data.stock !== undefined || data.unit !== undefined || data.name !== undefined ||
      data.description !== undefined) {
    update.gstEnabled = shop.gstEnabled;
  }
  if (data.imageUrl !== undefined || data.imagePublicId !== undefined) {
    update.imageUrl = data.imageUrl ?? "";
    update.imagePublicId = data.imagePublicId ?? "";
    validateImageOwnership(shop._id, update.imageUrl, update.imagePublicId);
  }
  Object.assign(product, update);
  await product.save();

  let warning = "";
  if (oldPublicId && oldPublicId !== product.imagePublicId) {
    try {
      await deleteProductImage(shop._id, oldPublicId);
    } catch (error) {
      warning = "Product saved, but its previous Cloudinary image could not be removed.";
      console.error("Previous product image cleanup failed.", { code: error.code || "CLOUDINARY_DELETE_FAILED" });
    }
  }
  await product.populate("shopId", "name");
  emitToAll("catalog.updated", { productId: String(product._id) });
  return { product: serializeProduct(product), warning };
}

export async function setProductPublished(userId, productId, published) {
  if (!mongoose.isValidObjectId(productId)) throw new ApiError(400, "Invalid product.", "INVALID_ID");
  const shop = await getOwnedShop(userId);
  const product = await Product.findOneAndUpdate(
    { _id: productId, shopId: shop._id, isActive: true },
    { $set: { published } },
    { new: true, runValidators: true }
  ).populate("shopId", "name");
  if (!product) throw new ApiError(404, "Product not found.", "PRODUCT_NOT_FOUND");
  emitToAll("catalog.updated", { productId: String(product._id) });
  return serializeProduct(product);
}

export async function archiveProduct(userId, productId) {
  if (!mongoose.isValidObjectId(productId)) throw new ApiError(400, "Invalid product.", "INVALID_ID");
  const shop = await getOwnedShop(userId);
  const product = await Product.findOneAndUpdate(
    { _id: productId, shopId: shop._id, isActive: true },
    { $set: { isActive: false, published: false } },
    { new: true }
  );
  if (!product) throw new ApiError(404, "Product not found.", "PRODUCT_NOT_FOUND");
  emitToAll("catalog.updated", { productId: String(product._id) });
  let warning = "";
  if (product.imagePublicId) {
    try {
      await deleteProductImage(shop._id, product.imagePublicId);
    } catch (error) {
      warning = "Product archived, but its Cloudinary image could not be removed.";
      console.error("Archived product image cleanup failed.", { code: error.code || "CLOUDINARY_DELETE_FAILED" });
    }
  }
  return { id: String(product._id), warning };
}

export async function productForBooking(productId) {
  if (!mongoose.isValidObjectId(productId)) throw new ApiError(404, "That product is no longer available.", "PRODUCT_NOT_FOUND");
  const product = await Product.findOne({ _id: productId, published: true, isActive: true })
    .populate({ path: "shopId", match: { isActive: true }, select: "name gstEnabled" });
  if (!product?.shopId) throw new ApiError(404, "That product is no longer available.", "PRODUCT_NOT_FOUND");
  return product;
}
