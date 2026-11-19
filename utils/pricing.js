export const DEFAULT_PLATFORM_FEE = 12;

const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function calculateBookingCharges(product, quantity, platformFee = DEFAULT_PLATFORM_FEE) {
  const subtotal = roundMoney(Number(product.price) * Number(quantity));
  const gstRate = Number(product.gstEnabled ? product.gstRate : 0);
  const gst = roundMoney(subtotal * gstRate / 100);
  const fee = roundMoney(Number(platformFee));
  return {
    subtotal,
    gstRate,
    gst,
    platformFee: fee,
    amount: roundMoney(subtotal + gst + fee)
  };
}
