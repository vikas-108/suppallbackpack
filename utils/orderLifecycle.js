export const ORDER_STATUSES = [
  "Pending",
  "Accepted",
  "Packing",
  "Ready for delivery",
  "Out for delivery",
  "Order placed at site",
  "Delivered",
  "Completed",
  "Declined",
  "Cancelled"
];

const LEGACY_STATUS_MAP = {
  Processing: "Accepted",
  Paid: "Accepted",
  Delivered: "Order placed at site"
};

const NEXT_STATUS_BY_ROLE = {
  shop_owner: {
    Pending: "Accepted",
    Accepted: "Packing",
    Packing: "Ready for delivery",
    "Order placed at site": "Completed"
  },
  delivery: {
    "Ready for delivery": "Out for delivery",
    "Out for delivery": "Order placed at site"
  }
};

const BUYER_CANCELLABLE_STATUSES = new Set([
  "Pending",
  "Accepted",
  "Packing",
  "Ready for delivery"
]);

export function normalizeOrderStatus(status) {
  return LEGACY_STATUS_MAP[status] || status;
}

export function canBuyerCancelOrder(status) {
  return BUYER_CANCELLABLE_STATUSES.has(normalizeOrderStatus(status));
}

export function nextOrderStatus(status, role) {
  return NEXT_STATUS_BY_ROLE[role]?.[normalizeOrderStatus(status)] || "";
}

export function canTransitionOrderStatus(currentStatus, nextStatus, role) {
  return nextOrderStatus(currentStatus, role) === nextStatus ||
    (role === "shop_owner" && normalizeOrderStatus(currentStatus) === "Pending" && nextStatus === "Declined") ||
    (role === "buyer" && nextStatus === "Cancelled" && canBuyerCancelOrder(currentStatus));
}
