import { describe, it, expect } from 'vitest';
import { addBillingPeriod, isLeapYear, getDaysInMonth } from '../src/lib/billing/calendar';
import { calculateInvoiceTotals, roundHalfUp, allocateDiscountAcrossLines, InputLineItem } from '../src/lib/billing/tax';
import { evaluateDiscount, resolveBestDiscounts, DiscountRule } from '../src/lib/billing/discount';
import { validatePassword } from '../src/lib/auth';

describe('Invariant 4: Month-end anchoring', () => {
  it('anchors Jan 31 monthly -> Feb 28/29, Mar 31, Apr 30 without drift', () => {
    // Start on Jan 31, 2026 (non-leap year)
    const jan31 = new Date(Date.UTC(2026, 0, 31));
    const anchorDay = 31;

    // Month 1: Feb
    const feb = addBillingPeriod(jan31, 'monthly', anchorDay, 1);
    expect(feb.getUTCFullYear()).toBe(2026);
    expect(feb.getUTCMonth()).toBe(1); // Feb
    expect(feb.getUTCDate()).toBe(28);

    // Month 2: Mar (should return to 31!)
    const mar = addBillingPeriod(jan31, 'monthly', anchorDay, 2);
    expect(mar.getUTCFullYear()).toBe(2026);
    expect(mar.getUTCMonth()).toBe(2); // Mar
    expect(mar.getUTCDate()).toBe(31);

    // Month 3: Apr (30 days)
    const apr = addBillingPeriod(jan31, 'monthly', anchorDay, 3);
    expect(apr.getUTCFullYear()).toBe(2026);
    expect(apr.getUTCMonth()).toBe(3); // Apr
    expect(apr.getUTCDate()).toBe(30);

    // Month 4: May (31 days)
    const may = addBillingPeriod(jan31, 'monthly', anchorDay, 4);
    expect(may.getUTCFullYear()).toBe(2026);
    expect(may.getUTCMonth()).toBe(4); // May
    expect(may.getUTCDate()).toBe(31);
  });

  it('handles leap year Feb 29 for Jan 31 anchor', () => {
    // 2028 is a leap year
    const jan31_2028 = new Date(Date.UTC(2028, 0, 31));
    const feb_2028 = addBillingPeriod(jan31_2028, 'monthly', 31, 1);
    expect(feb_2028.getUTCFullYear()).toBe(2028);
    expect(feb_2028.getUTCMonth()).toBe(1);
    expect(feb_2028.getUTCDate()).toBe(29);
  });
});

describe('Invariant 5: Yearly anchored on Feb 29', () => {
  it('anchors Feb 29 -> Feb 28 on non-leap, back to Feb 29 on leap year', () => {
    const leapStart = new Date(Date.UTC(2024, 1, 29)); // 2024 is leap
    const anchorDay = 29;

    // +1 year: 2025 (non-leap) -> Feb 28
    const y2025 = addBillingPeriod(leapStart, 'yearly', anchorDay, 1);
    expect(y2025.getUTCFullYear()).toBe(2025);
    expect(y2025.getUTCDate()).toBe(28);

    // +4 years: 2028 (leap year) -> Feb 29
    const y2028 = addBillingPeriod(leapStart, 'yearly', anchorDay, 4);
    expect(y2028.getUTCFullYear()).toBe(2028);
    expect(y2028.getUTCDate()).toBe(29);
  });
});

describe('Invariant 1: Exact paisa reconciliation and rounding', () => {
  it('sum(line.total) == invoice.total to the paisa with tax & discount', () => {
    const lines: InputLineItem[] = [
      {
        description: 'Software Seat (Odoo Variant)',
        quantity: 5,
        unitPrice: 156000n, // ₹1,560.00
        taxes: [{ id: 'gst18', name: 'GST 18%', rateBp: 1800, type: 'percent', priceIncluded: false }],
      },
      {
        description: 'Cloud Backup Add-on',
        quantity: 1,
        unitPrice: 49900n, // ₹499.00
        taxes: [{ id: 'gst18', name: 'GST 18%', rateBp: 1800, type: 'percent', priceIncluded: false }],
      },
    ];

    // ₹500 subscription-level discount (50000 paise)
    const result = calculateInvoiceTotals(lines, 50000n);

    // Check line sum reconciles exactly with total
    const sumLines = result.lines.reduce((s, l) => s + l.totalAmount, 0n);
    expect(result.total).toBe(sumLines);

    // Check that largest-remainder allocated discounts sum exactly to 50000n
    const totalAllocatedDiscount = result.lines.reduce((s, l) => s + l.discountAmount, 0n);
    expect(totalAllocatedDiscount).toBe(50000n);
  });

  it('handles inclusive tax without 1-paisa drift', () => {
    const lines: InputLineItem[] = [
      {
        description: 'Inclusive Tax Product',
        quantity: 3,
        unitPrice: 100000n, // ₹1,000.00 incl 18% GST
        taxes: [{ id: 'gst18_inc', name: 'GST 18% (Incl)', rateBp: 1800, type: 'percent', priceIncluded: true }],
      },
    ];

    const result = calculateInvoiceTotals(lines);
    expect(result.total).toBe(300000n); // exactly ₹3,000.00
    expect(result.subtotal).toBe(300000n);
    // Line total matches
    expect(result.lines[0].totalAmount).toBe(300000n);
  });
});

describe('Invariant 6 & 7: Discount Engine Eligibility & Limits', () => {
  const baseDiscount: DiscountRule = {
    id: 'disc-1',
    name: '10% on >= 10 seats',
    type: 'percent',
    value: 1000n, // 10% = 1000 bp
    minPurchaseAmount: 0n,
    minQuantity: 10,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    usageLimit: 3,
    usedCount: 0,
    scope: 'subscription',
    stackable: false,
    isActive: true,
  };

  it('applies when quantity and dates match', () => {
    const evalResult = evaluateDiscount(
      baseDiscount,
      new Date('2026-06-15'),
      [{ productId: 'p1', quantity: 15, grossAmount: 1500000n }]
    );
    expect(evalResult.eligible).toBe(true);
    expect(evalResult.amount).toBe(150000n); // 10% of 15,000
  });

  it('rejects when quantity is below min_quantity', () => {
    const evalResult = evaluateDiscount(
      baseDiscount,
      new Date('2026-06-15'),
      [{ productId: 'p1', quantity: 8, grossAmount: 800000n }]
    );
    expect(evalResult.eligible).toBe(false);
    expect(evalResult.amount).toBe(0n);
  });

  it('rejects when usageLimit is exhausted (usedCount >= usageLimit)', () => {
    const exhaustedDiscount = { ...baseDiscount, usedCount: 3 };
    const evalResult = evaluateDiscount(
      exhaustedDiscount,
      new Date('2026-06-15'),
      [{ productId: 'p1', quantity: 15, grossAmount: 1500000n }]
    );
    expect(evalResult.eligible).toBe(false);
    expect(evalResult.ineligibleReason).toBe('USAGE_LIMIT_EXHAUSTED');
  });

  it('rejects when invoice date is past discount endDate', () => {
    const evalResult = evaluateDiscount(
      baseDiscount,
      new Date('2027-01-01'),
      [{ productId: 'p1', quantity: 15, grossAmount: 1500000n }]
    );
    expect(evalResult.eligible).toBe(false);
    expect(evalResult.ineligibleReason).toBe('DATE_OUT_OF_RANGE');
  });
});

describe('Invariant 11: Password Policy (D1)', () => {
  it('fails at length 8 and passes at length >= 9 with all criteria', () => {
    // Length 8: fail
    expect(validatePassword('Abcde1!a').isValid).toBe(false);
    // Length 9: pass
    expect(validatePassword('Abcdef1!a').isValid).toBe(true);
    // Missing uppercase: fail
    expect(validatePassword('abcdef1!a').isValid).toBe(false);
    // Missing lowercase: fail
    expect(validatePassword('ABCDEF1!A').isValid).toBe(false);
    // Missing special character: fail
    expect(validatePassword('Abcdef123').isValid).toBe(false);
  });
});
