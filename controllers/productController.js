import {
  archiveProduct,
  createProduct,
  listPublicProducts,
  listShopProducts,
  recordProductViews,
  setProductPublished,
  submitProductRating,
  updateProduct
} from "../services/productService.js";
import { getShopId } from "../services/shopService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendData } from "../utils/response.js";
import {
  productRatingSchema,
  productSchema,
  productUpdateSchema,
  productViewsSchema,
  publicationSchema
} from "../utils/validation.js";

export const getPublicProducts = asyncHandler(async (_req, res) => {
  sendData(res, { products: await listPublicProducts() });
});

export const addProductViews = asyncHandler(async (req, res) => {
  const { productIds } = productViewsSchema.parse(req.body);
  sendData(res, { views: await recordProductViews(productIds) });
});

export const rateProduct = asyncHandler(async (req, res) => {
  const data = productRatingSchema.parse(req.body);
  const product = await submitProductRating(req.params.productId, data);
  sendData(res, { product });
});

export const getMyProducts = asyncHandler(async (req, res) => {
  sendData(res, { products: await listShopProducts(req.user._id) });
});

export const addProduct = asyncHandler(async (req, res) => {
  const data = productSchema.parse(req.body);
  const product = await createProduct(req.user._id, data);
  sendData(res, { product }, 201);
});

export const editProduct = asyncHandler(async (req, res) => {
  const data = productUpdateSchema.parse(req.body);
  const result = await updateProduct(req.user._id, req.params.productId, data);
  sendData(res, result);
});

export const setPublication = asyncHandler(async (req, res) => {
  const { published } = publicationSchema.parse(req.body);
  const product = await setProductPublished(req.user._id, req.params.productId, published);
  sendData(res, { product });
});

export const removeProduct = asyncHandler(async (req, res) => {
  const result = await archiveProduct(req.user._id, req.params.productId);
  sendData(res, result);
});
