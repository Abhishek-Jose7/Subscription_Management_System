/**
 * Discount Engine (PRD Section 7.5)
 * 
 * Rules:
 * - Evaluated dynamically at invoice generation (never cached on subscription).
 * - Best value wins for non-stackable discounts.
 * - Stops when expired or usage limit reached.
 * - Discount cannot push line below 0.
 */

export interface DiscountRule {
  id: string;
  name: string;
  type: 'fixed' | 'percent';
  value: bigint; // paise for fixed, basis points for percent
  minPurchaseAmount: bigint; // paise
  minQuantity: number;
  startDate: Date;
  endDate: Date;
  usageLimit: number;
  usedCount: number;
  scope: 'products' | 'subscription';
  stackable: boolean;
  isActive: boolean;
  productIds?: string[];
}

export interface DiscountableLine {
  productId?: string | null;
  quantity: number;
  grossAmount: bigint; // paise
}

export interface DiscountEvaluationResult {
  discountId: string;
  name: string;
  eligible: boolean;
  ineligibleReason?: string;
  scope: 'products' | 'subscription';
  amount: bigint; // paise saved
  targetProductIds?: string[];
}

/** Check if a discount rule is eligible for an invoice */
export function evaluateDiscount(
  discount: DiscountRule,
  invoiceDate: Date,
  lines: DiscountableLine[]
): DiscountEvaluationResult {
  if (!discount.isActive) {
    return {
      discountId: discount.id,
      name: discount.name,
      eligible: false,
      ineligibleReason: 'DISCOUNT_INACTIVE',
      scope: discount.scope,
      amount: 0n,
    };
  }

  // Check date window (inclusive)
  const invDateOnly = new Date(invoiceDate).toISOString().split('T')[0];
  const startDateOnly = new Date(discount.startDate).toISOString().split('T')[0];
  const endDateOnly = new Date(discount.endDate).toISOString().split('T')[0];

  if (invDateOnly < startDateOnly || invDateOnly > endDateOnly) {
    return {
      discountId: discount.id,
      name: discount.name,
      eligible: false,
      ineligibleReason: 'DATE_OUT_OF_RANGE',
      scope: discount.scope,
      amount: 0n,
    };
  }

  // Check usage limit
  if (discount.usedCount >= discount.usageLimit) {
    return {
      discountId: discount.id,
      name: discount.name,
      eligible: false,
      ineligibleReason: 'USAGE_LIMIT_EXHAUSTED',
      scope: discount.scope,
      amount: 0n,
    };
  }

  // Calculate scoped amount and scoped quantity
  let scopedGross = 0n;
  let scopedQty = 0;

  if (discount.scope === 'products' && discount.productIds && discount.productIds.length > 0) {
    for (const line of lines) {
      if (line.productId && discount.productIds.includes(line.productId)) {
        scopedGross += line.grossAmount;
        scopedQty += line.quantity;
      }
    }
  } else {
    // Whole subscription
    for (const line of lines) {
      scopedGross += line.grossAmount;
      scopedQty += line.quantity;
    }
  }

  if (scopedQty < discount.minQuantity) {
    return {
      discountId: discount.id,
      name: discount.name,
      eligible: false,
      ineligibleReason: `MIN_QUANTITY_NOT_MET (required ${discount.minQuantity}, found ${scopedQty})`,
      scope: discount.scope,
      amount: 0n,
    };
  }

  if (scopedGross < discount.minPurchaseAmount) {
    return {
      discountId: discount.id,
      name: discount.name,
      eligible: false,
      ineligibleReason: `MIN_PURCHASE_NOT_MET`,
      scope: discount.scope,
      amount: 0n,
    };
  }

  // Calculate discount amount
  let discountAmount = 0n;
  if (discount.type === 'percent') {
    // value is in basis points (e.g. 1000 = 10%)
    discountAmount = (scopedGross * discount.value) / 10000n;
  } else {
    // fixed amount in paise
    discountAmount = discount.value;
  }

  // Cap at scoped gross so it never exceeds line/subtotal amount
  if (discountAmount > scopedGross) {
    discountAmount = scopedGross;
  }

  return {
    discountId: discount.id,
    name: discount.name,
    eligible: true,
    scope: discount.scope,
    amount: discountAmount,
    targetProductIds: discount.productIds,
  };
}

/**
 * Select best discounts:
 * If non-stackable, selects the single discount offering largest absolute saving.
 * If stackable, combines eligible discounts.
 */
export function resolveBestDiscounts(
  discounts: DiscountRule[],
  invoiceDate: Date,
  lines: DiscountableLine[]
): DiscountEvaluationResult[] {
  const evaluated = discounts
    .map((d) => evaluateDiscount(d, invoiceDate, lines))
    .filter((e) => e.eligible && e.amount > 0n);

  if (evaluated.length === 0) return [];

  // Check if all are stackable
  const allStackable = evaluated.every((e) => {
    const rule = discounts.find((d) => d.id === e.discountId);
    return rule?.stackable;
  });

  if (allStackable) {
    return evaluated;
  }

  // Non-stackable default: highest amount wins
  evaluated.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
  return [evaluated[0]];
}
