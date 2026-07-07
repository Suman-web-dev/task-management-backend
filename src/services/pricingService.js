/**
 * Pricing Service
 * Handles automatic discounts and coupon logic
 */

const AUTOMATIC_DISCOUNT_THRESHOLD = 1000;
const AUTOMATIC_DISCOUNT_PERCENTAGE = 0.10;

/**
 * Calculate automatic discount (10% for orders above ₹1000)
 */
const calculateAutomaticDiscount = (subtotal) => {
  if (subtotal >= AUTOMATIC_DISCOUNT_THRESHOLD) {
    return subtotal * AUTOMATIC_DISCOUNT_PERCENTAGE;
  }
  return 0;
};

/**
 * Calculate coupon discount
 */
const calculateCouponDiscount = (coupon, subtotal) => {
  if (!coupon || subtotal < coupon.minOrderValue) {
    return 0;
  }

  let discount = 0;
  if (coupon.type === 'flat') {
    discount = coupon.value;
  } else if (coupon.type === 'percentage') {
    discount = subtotal * (coupon.value / 100);
    if (coupon.maxCap) {
      discount = Math.min(discount, coupon.maxCap);
    }
  }

  return Math.min(discount, subtotal);
};

/**
 * Calculate the best discount (automatic vs coupon)
 * Returns the discount amount and which type was applied
 */
const calculateBestDiscount = (subtotal, coupon = null) => {
  const automaticDiscount = calculateAutomaticDiscount(subtotal);
  const couponDiscount = coupon ? calculateCouponDiscount(coupon, subtotal) : 0;

  if (couponDiscount >= automaticDiscount) {
    return {
      discount: couponDiscount,
      discountType: coupon ? 'coupon' : 'none',
      couponCode: coupon ? coupon.code : null,
    };
  }

  return {
    discount: automaticDiscount,
    discountType: 'automatic',
    couponCode: null,
  };
};

/**
 * Calculate order total with items and optional coupon
 */
const calculateOrderTotal = (items, coupon = null) => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const { discount, discountType, couponCode } = calculateBestDiscount(subtotal, coupon);
  const total = subtotal - discount;

  return {
    subtotal,
    discount,
    discountType,
    couponCode,
    total,
  };
};

module.exports = {
  calculateAutomaticDiscount,
  calculateCouponDiscount,
  calculateBestDiscount,
  calculateOrderTotal,
  AUTOMATIC_DISCOUNT_THRESHOLD,
  AUTOMATIC_DISCOUNT_PERCENTAGE,
};
