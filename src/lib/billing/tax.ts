/**
 * Tax Calculation Engine (PRD Section 7.4)
 * 
 * Rules:
 * - Integer minor units (paise) throughout.
 * - Rate in basis points (1800 = 18%, 500 = 5%).
 * - Round half up per line.
 * - Largest-remainder proportional discount allocation to avoid 1-paisa drift.
 * - Explainable price waterfall per line.
 */

export interface TaxRule {
  id: string;
  name: string;
  rateBp: number; // e.g. 1800 for 18%
  type: 'percent' | 'fixed';
  priceIncluded: boolean;
  gstComponent?: 'cgst' | 'sgst' | 'igst' | null;
}

export interface InputLineItem {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: bigint; // paise
  taxes: TaxRule[];
  lineDiscountAmount?: bigint; // paise directly assigned to this line
}

export interface CalculatedLineItem {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: bigint;
  grossAmount: bigint;
  discountAmount: bigint;
  netAmount: bigint;
  taxAmount: bigint;
  totalAmount: bigint;
  explain: {
    baseUnitPrice: string;
    quantity: number;
    grossAmount: string;
    discountAmount: string;
    netAmount: string;
    taxes: Array<{
      name: string;
      rate: string;
      priceIncluded: boolean;
      amount: string;
    }>;
    taxTotal: string;
    finalTotal: string;
  };
}

export interface InvoiceCalculationResult {
  lines: CalculatedLineItem[];
  subtotal: bigint; // sum of gross or net amounts
  discountTotal: bigint;
  taxTotal: bigint;
  total: bigint; // subtotal - discountTotal + taxTotal (for tax-exclusive)
}

/** Round half up for integer division: round_half_up(num / den) */
export function roundHalfUp(num: bigint, den: bigint): bigint {
  if (den === 0n) return 0n;
  const isNegative = (num < 0n) !== (den < 0n);
  const absNum = num < 0n ? -num : num;
  const absDen = den < 0n ? -den : den;

  const quotient = absNum / absDen;
  const remainder = absNum % absDen;

  // round up if 2 * remainder >= den
  const shouldRoundUp = 2n * remainder >= absDen;
  const finalQuotient = shouldRoundUp ? quotient + 1n : quotient;

  return isNegative ? -finalQuotient : finalQuotient;
}

/**
 * Allocate a subscription-level discount across lines using largest-remainder method
 * so allocated parts sum exactly to the discount without 1-paisa drift.
 */
export function allocateDiscountAcrossLines(
  lines: InputLineItem[],
  totalDiscount: bigint
): bigint[] {
  if (totalDiscount <= 0n || lines.length === 0) {
    return lines.map(() => 0n);
  }

  const grossAmounts = lines.map((l) => l.unitPrice * BigInt(l.quantity));
  const totalGross = grossAmounts.reduce((sum, g) => sum + g, 0n);

  if (totalGross === 0n) {
    return lines.map(() => 0n);
  }

  // Cap total discount at total gross
  const cappedDiscount = totalDiscount > totalGross ? totalGross : totalDiscount;

  // Step 1: Compute floor shares and remainders
  const shares: bigint[] = [];
  const remainders: { index: number; remainder: bigint }[] = [];
  let allocatedSum = 0n;

  for (let i = 0; i < lines.length; i++) {
    const gross = grossAmounts[i];
    const num = cappedDiscount * gross;
    const share = num / totalGross;
    const rem = num % totalGross;

    shares.push(share);
    allocatedSum += share;
    remainders.push({ index: i, remainder: rem });
  }

  // Step 2: Distribute leftover paise to largest remainders
  let leftover = cappedDiscount - allocatedSum;
  remainders.sort((a, b) => (b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : 0));

  for (let i = 0; i < Number(leftover); i++) {
    shares[remainders[i].index] += 1n;
  }

  return shares;
}

/**
 * Calculate line totals and taxes
 */
export function calculateInvoiceTotals(
  inputLines: InputLineItem[],
  subscriptionDiscount: bigint = 0n
): InvoiceCalculationResult {
  const allocatedDiscounts = allocateDiscountAcrossLines(inputLines, subscriptionDiscount);

  let subtotal = 0n;
  let discountTotal = 0n;
  let taxTotal = 0n;
  let total = 0n;

  const calculatedLines: CalculatedLineItem[] = [];

  for (let i = 0; i < inputLines.length; i++) {
    const line = inputLines[i];
    const qty = BigInt(line.quantity);
    const lineGross = line.unitPrice * qty;

    // Combine direct line discount + allocated subscription discount
    const directDiscount = line.lineDiscountAmount ?? 0n;
    const allocatedDiscount = allocatedDiscounts[i] ?? 0n;
    let lineDiscount = directDiscount + allocatedDiscount;

    if (lineDiscount > lineGross) {
      lineDiscount = lineGross; // never below 0
    }

    const lineNet = lineGross - lineDiscount;

    let lineTaxSum = 0n;
    const taxExplains: Array<{ name: string; rate: string; priceIncluded: boolean; amount: string }> = [];

    let isPriceIncluded = false;

    for (const tax of line.taxes) {
      if (tax.type === 'fixed') {
        // Fixed tax per line or quantity
        const tAmount = BigInt(tax.rateBp); // paise
        lineTaxSum += tAmount;
        taxExplains.push({
          name: tax.name,
          rate: `Fixed`,
          priceIncluded: tax.priceIncluded,
          amount: (Number(tAmount) / 100).toFixed(2),
        });
      } else {
        // Percent tax: rateBp (e.g. 1800 for 18.00%)
        const rateBpBig = BigInt(tax.rateBp);
        if (tax.priceIncluded) {
          isPriceIncluded = true;
          // tax = lineNet - round_half_up(lineNet / (1 + rate))
          // = lineNet - round_half_up(lineNet * 10000 / (10000 + rateBp))
          const denominator = 10000n + rateBpBig;
          const numerator = lineNet * 10000n;
          const preTax = roundHalfUp(numerator, denominator);
          const tAmount = lineNet - preTax;
          lineTaxSum += tAmount;
          taxExplains.push({
            name: tax.name,
            rate: `${(tax.rateBp / 100).toFixed(2)}% (Incl)`,
            priceIncluded: true,
            amount: (Number(tAmount) / 100).toFixed(2),
          });
        } else {
          // tax = round_half_up(lineNet * rateBp / 10000)
          const tAmount = roundHalfUp(lineNet * rateBpBig, 10000n);
          lineTaxSum += tAmount;
          taxExplains.push({
            name: tax.name,
            rate: `${(tax.rateBp / 100).toFixed(2)}%`,
            priceIncluded: false,
            amount: (Number(tAmount) / 100).toFixed(2),
          });
        }
      }
    }

    // Final line total
    const lineFinalTotal = isPriceIncluded ? lineNet : lineNet + lineTaxSum;

    subtotal += lineGross;
    discountTotal += lineDiscount;
    taxTotal += lineTaxSum;
    total += lineFinalTotal;

    calculatedLines.push({
      id: line.id,
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      grossAmount: lineGross,
      discountAmount: lineDiscount,
      netAmount: lineNet,
      taxAmount: lineTaxSum,
      totalAmount: lineFinalTotal,
      explain: {
        baseUnitPrice: (Number(line.unitPrice) / 100).toFixed(2),
        quantity: line.quantity,
        grossAmount: (Number(lineGross) / 100).toFixed(2),
        discountAmount: (Number(lineDiscount) / 100).toFixed(2),
        netAmount: (Number(lineNet) / 100).toFixed(2),
        taxes: taxExplains,
        taxTotal: (Number(lineTaxSum) / 100).toFixed(2),
        finalTotal: (Number(lineFinalTotal) / 100).toFixed(2),
      },
    });
  }

  return {
    lines: calculatedLines,
    subtotal,
    discountTotal,
    taxTotal,
    total,
  };
}
