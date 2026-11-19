const RATING_PRIOR = 4;
const RATING_PRIOR_COUNT = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function rankProducts(products, now = new Date()) {
  const maxOrders = products.reduce((max, product) => Math.max(max, Number(product.totalOrders || 0)), 0);
  const maxViews = products.reduce((max, product) => Math.max(max, Number(product.views || 0)), 0);
  const orderScale = Math.log1p(maxOrders);
  const viewScale = Math.log1p(maxViews);

  return products.map(product => {
    const ratingCount = Number(product.ratingCount || 0);
    const averageRating = Number(product.averageRating || 0);
    const priorRating = (
      averageRating * ratingCount + RATING_PRIOR * RATING_PRIOR_COUNT
    ) / (ratingCount + RATING_PRIOR_COUNT);
    const orderPopularity = orderScale ? Math.log1p(Number(product.totalOrders || 0)) / orderScale : 0;
    const viewPopularity = viewScale ? Math.log1p(Number(product.views || 0)) / viewScale : 0;
    const createdAt = Date.parse(product.createdAt || "");
    const ageDays = Number.isFinite(createdAt)
      ? Math.max(0, (now.getTime() - createdAt) / MS_PER_DAY)
      : 365;
    const freshness = Math.exp(-ageDays / 30);
    const recommendationScore = (
      (priorRating / 5) * 0.45 +
      orderPopularity * 0.25 +
      viewPopularity * 0.15 +
      freshness * 0.15
    );

    return { ...product, recommendationScore };
  }).sort((left, right) =>
    right.recommendationScore - left.recommendationScore ||
    Date.parse(right.createdAt || "") - Date.parse(left.createdAt || "")
  );
}
