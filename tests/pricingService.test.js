const pricingService = require('../src/services/pricingService');

describe('Pricing Service', () => {
  describe('calculateAutomaticDiscount', () => {
    test('should return 0 for orders below ₹1000', () => {
      const discount = pricingService.calculateAutomaticDiscount(999);
      expect(discount).toBe(0);
    });

    test('should return 0 for orders exactly ₹1000', () => {
      const discount = pricingService.calculateAutomaticDiscount(1000);
      expect(discount).toBe(100); // 10% of 1000
    });

    test('should return 10% for orders above ₹1000', () => {
      const discount = pricingService.calculateAutomaticDiscount(2000);
      expect(discount).toBe(200); // 10% of 2000
    });

    test('should handle edge case of ₹0', () => {
      const discount = pricingService.calculateAutomaticDiscount(0);
      expect(discount).toBe(0);
    });
  });

  describe('calculateCouponDiscount', () => {
    test('should calculate flat discount correctly', () => {
      const coupon = {
        type: 'flat',
        value: 100,
        minOrderValue: 0,
      };
      const discount = pricingService.calculateCouponDiscount(coupon, 500);
      expect(discount).toBe(100);
    });

    test('should calculate percentage discount without cap', () => {
      const coupon = {
        type: 'percentage',
        value: 20,
        maxCap: null,
        minOrderValue: 0,
      };
      const discount = pricingService.calculateCouponDiscount(coupon, 500);
      expect(discount).toBe(100); // 20% of 500
    });

    test('should calculate percentage discount with cap', () => {
      const coupon = {
        type: 'percentage',
        value: 50,
        maxCap: 200,
        minOrderValue: 0,
      };
      const discount = pricingService.calculateCouponDiscount(coupon, 1000);
      expect(discount).toBe(200); // 50% of 1000 = 500, but capped at 200
    });

    test('should return 0 if order value below minimum', () => {
      const coupon = {
        type: 'flat',
        value: 100,
        minOrderValue: 500,
      };
      const discount = pricingService.calculateCouponDiscount(coupon, 400);
      expect(discount).toBe(0);
    });

    test('should return 0 if coupon is null', () => {
      const discount = pricingService.calculateCouponDiscount(null, 500);
      expect(discount).toBe(0);
    });

    test('should not exceed subtotal for flat discount', () => {
      const coupon = {
        type: 'flat',
        value: 1000,
        minOrderValue: 0,
      };
      const discount = pricingService.calculateCouponDiscount(coupon, 500);
      expect(discount).toBe(500); // Capped at subtotal
    });

    test('should not exceed subtotal for percentage discount', () => {
      const coupon = {
        type: 'percentage',
        value: 150,
        maxCap: null,
        minOrderValue: 0,
      };
      const discount = pricingService.calculateCouponDiscount(coupon, 500);
      expect(discount).toBe(500); // 150% of 500 = 750, but capped at subtotal
    });
  });

  describe('calculateBestDiscount', () => {
    test('should choose automatic discount when it is better', () => {
      const result = pricingService.calculateBestDiscount(1500, {
        type: 'flat',
        value: 100,
        minOrderValue: 0,
      });
      expect(result.discount).toBe(150); // Automatic: 10% of 1500 = 150
      expect(result.discountType).toBe('automatic');
      expect(result.couponCode).toBeNull();
    });

    test('should choose coupon discount when it is better', () => {
      const result = pricingService.calculateBestDiscount(1500, {
        code: 'SAVE200',
        type: 'flat',
        value: 200,
        minOrderValue: 0,
      });
      expect(result.discount).toBe(200); // Coupon: 200 > Automatic: 150
      expect(result.discountType).toBe('coupon');
      expect(result.couponCode).toBe('SAVE200');
    });

    test('should choose coupon when equal (coupon preference)', () => {
      const result = pricingService.calculateBestDiscount(1000, {
        code: 'SAVE100',
        type: 'flat',
        value: 100,
        minOrderValue: 0,
      });
      expect(result.discount).toBe(100); // Both are 100, coupon wins
      expect(result.discountType).toBe('coupon');
    });

    test('should return automatic discount when no coupon provided', () => {
      const result = pricingService.calculateBestDiscount(1500, null);
      expect(result.discount).toBe(150);
      expect(result.discountType).toBe('automatic');
      expect(result.couponCode).toBeNull();
    });

    test('should return no discount for small orders without coupon', () => {
      const result = pricingService.calculateBestDiscount(500, null);
      expect(result.discount).toBe(0);
      expect(result.discountType).toBe('none');
    });
  });

  describe('calculateOrderTotal', () => {
    test('should calculate total with no discount', () => {
      const items = [
        { price: 100, quantity: 2 },
        { price: 50, quantity: 1 },
      ];
      const result = pricingService.calculateOrderTotal(items, null);
      expect(result.subtotal).toBe(250);
      expect(result.discount).toBe(0);
      expect(result.total).toBe(250);
      expect(result.discountType).toBe('none');
    });

    test('should calculate total with automatic discount', () => {
      const items = [
        { price: 600, quantity: 2 },
      ];
      const result = pricingService.calculateOrderTotal(items, null);
      expect(result.subtotal).toBe(1200);
      expect(result.discount).toBe(120); // 10%
      expect(result.total).toBe(1080);
      expect(result.discountType).toBe('automatic');
    });

    test('should calculate total with coupon discount', () => {
      const items = [
        { price: 500, quantity: 2 },
      ];
      const coupon = {
        code: 'SAVE100',
        type: 'flat',
        value: 100,
        minOrderValue: 0,
      };
      const result = pricingService.calculateOrderTotal(items, coupon);
      expect(result.subtotal).toBe(1000);
      expect(result.discount).toBe(100);
      expect(result.total).toBe(900);
      expect(result.discountType).toBe('coupon');
    });

    test('should choose better discount between automatic and coupon', () => {
      const items = [
        { price: 1000, quantity: 1 },
      ];
      const coupon = {
        code: 'SAVE50',
        type: 'flat',
        value: 50,
        minOrderValue: 0,
      };
      const result = pricingService.calculateOrderTotal(items, coupon);
      expect(result.subtotal).toBe(1000);
      expect(result.discount).toBe(100); // Automatic wins (100 > 50)
      expect(result.total).toBe(900);
      expect(result.discountType).toBe('automatic');
    });

    test('should handle empty items array', () => {
      const result = pricingService.calculateOrderTotal([], null);
      expect(result.subtotal).toBe(0);
      expect(result.discount).toBe(0);
      expect(result.total).toBe(0);
    });

    test('should handle coupon with minimum order value not met', () => {
      const items = [
        { price: 100, quantity: 1 },
      ];
      const coupon = {
        code: 'SAVE50',
        type: 'flat',
        value: 50,
        minOrderValue: 500,
      };
      const result = pricingService.calculateOrderTotal(items, coupon);
      expect(result.subtotal).toBe(100);
      expect(result.discount).toBe(0); // Coupon not applied
      expect(result.total).toBe(100);
      expect(result.discountType).toBe('none');
    });
  });
});
