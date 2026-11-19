export const PLATFORM_FEE_ELIGIBLE_ORDER_STATUSES = [
  "Order placed at site",
  "Completed",
  "Delivered"
];

const toCents = value => Math.round((Number(value) + Number.EPSILON) * 100);
const fromCents = value => value / 100;

export function summarizePlatformFeeSettlement(requestable, pending) {
  const requestableAmount = fromCents(toCents(requestable.amount || 0));
  const pendingAmount = fromCents(toCents(pending.amount || 0));
  return {
    amountDue: fromCents(toCents(requestableAmount) + toCents(pendingAmount)),
    requestableAmount,
    requestableOrderCount: Number(requestable.orderCount) || 0,
    pendingAmount,
    pendingOrderCount: Number(pending.orderCount) || 0,
    pendingSettlementCount: Number(pending.settlementCount) || 0
  };
}
