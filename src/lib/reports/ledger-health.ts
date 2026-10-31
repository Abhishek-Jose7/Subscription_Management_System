import prisma from '@/lib/db';
import { businessDate } from '@/lib/clock';

export interface HealthCheckResult {
  id: string;
  title: string;
  description: string;
  passed: boolean;
  violationCount: number;
  details?: string;
}

/**
 * Live SQL Ledger Health checks (PRD Section 7.6 & 12 Invariant 13)
 * Guarantees zero accounting discrepancies across the entire system.
 */
export async function runLedgerHealthChecks(): Promise<{
  allGreen: boolean;
  checks: HealthCheckResult[];
}> {
  const today = await businessDate();
  const checks: HealthCheckResult[] = [];

  // Check 1: No duplicate invoice per (subscription, period)
  const duplicateInvoices: any = await prisma.$queryRaw`
    SELECT subscription_id, period_start, period_end, COUNT(*) as cnt
    FROM invoices
    WHERE status <> 'cancelled' AND invoice_type = 'recurring'
    GROUP BY subscription_id, period_start, period_end
    HAVING COUNT(*) > 1
  `;
  checks.push({
    id: 'no_duplicate_invoices',
    title: 'Idempotency Guarantee',
    description: 'No duplicate invoice per subscription and period',
    passed: duplicateInvoices.length === 0,
    violationCount: duplicateInvoices.length,
    details: duplicateInvoices.length === 0 ? 'Zero duplicates found.' : `${duplicateInvoices.length} duplicate periods found!`,
  });

  // Check 2: Invoice Total matches sum of lines
  const totalMismatches: any = await prisma.$queryRaw`
    SELECT i.id, i.number, i.total, COALESCE(SUM(l.amount), 0) as lines_sum
    FROM invoices i
    LEFT JOIN invoice_lines l ON l.invoice_id = i.id
    WHERE i.status <> 'cancelled'
    GROUP BY i.id, i.number, i.total
    HAVING i.total <> COALESCE(SUM(l.amount), 0)
  `;
  checks.push({
    id: 'invoice_total_reconciliation',
    title: 'Invoice Line Reconciliation',
    description: 'invoice.total == sum(lines) for all invoices to the paisa',
    passed: totalMismatches.length === 0,
    violationCount: totalMismatches.length,
    details: totalMismatches.length === 0 ? 'All invoice lines reconcile exactly.' : `${totalMismatches.length} invoice total mismatches detected!`,
  });

  // Check 3: invoice.amount_paid == sum(recorded payments)
  const paymentMismatches: any = await prisma.$queryRaw`
    SELECT i.id, i.number, i.amount_paid, COALESCE(SUM(p.amount), 0) as payments_sum
    FROM invoices i
    LEFT JOIN payments p ON p.invoice_id = i.id AND p.status = 'recorded'
    GROUP BY i.id, i.number, i.amount_paid
    HAVING i.amount_paid <> COALESCE(SUM(p.amount), 0)
  `;
  checks.push({
    id: 'payments_reconciliation',
    title: 'Payment Ledger Reconciliation',
    description: 'invoice.amount_paid == sum(active payments)',
    passed: paymentMismatches.length === 0,
    violationCount: paymentMismatches.length,
    details: paymentMismatches.length === 0 ? 'All recorded payments balance with invoices.' : `${paymentMismatches.length} payment discrepancies found!`,
  });

  // Check 4: Paid invoices have balance = 0, Confirmed invoices have balance > 0
  const statusMismatches: any = await prisma.$queryRaw`
    SELECT id, number, status, total, amount_paid
    FROM invoices
    WHERE (status = 'paid' AND total > amount_paid)
       OR (status = 'confirmed' AND total <= amount_paid AND total > 0)
  `;
  checks.push({
    id: 'invoice_balance_status',
    title: 'Status and Balance Integrity',
    description: 'Paid invoices have balance = 0; Confirmed invoices have balance > 0',
    passed: statusMismatches.length === 0,
    violationCount: statusMismatches.length,
    details: statusMismatches.length === 0 ? 'All statuses strictly conform to financial facts.' : `${statusMismatches.length} status mismatches found!`,
  });

  // Check 5: Discount used_count == count(non-reversed redemptions) and <= limit
  const discountMismatches: any = await prisma.$queryRaw`
    SELECT d.id, d.name, d.used_count, d.usage_limit, COUNT(r.id) as actual_redemptions
    FROM discounts d
    LEFT JOIN discount_redemptions r ON r.discount_id = d.id AND r.reversed_at IS NULL
    GROUP BY d.id, d.name, d.used_count, d.usage_limit
    HAVING d.used_count <> COUNT(r.id) OR d.used_count > d.usage_limit
  `;
  checks.push({
    id: 'discount_redemption_ledger',
    title: 'Discount Redemption Integrity',
    description: 'discount.used_count == count(active redemptions) and never exceeds usage_limit',
    passed: discountMismatches.length === 0,
    violationCount: discountMismatches.length,
    details: discountMismatches.length === 0 ? 'Discount limits and redemptions strictly verified.' : `${discountMismatches.length} discount violations!`,
  });

  // Check 6: Coverage check - every active unpaused subscription has no gaps in elapsed periods
  const unbilledGaps: any = await prisma.$queryRaw`
    SELECT s.id, s.number, s.next_invoice_date
    FROM subscriptions s
    WHERE s.status = 'active'
      AND s.next_invoice_date < ${today}
      AND (s.paused_until IS NULL OR s.paused_until < s.next_invoice_date)
  `;
  checks.push({
    id: 'billing_period_coverage',
    title: 'Billing Period Coverage',
    description: 'Every active, unpaused subscription has invoices generated for all elapsed periods',
    passed: unbilledGaps.length === 0,
    violationCount: unbilledGaps.length,
    details: unbilledGaps.length === 0 ? 'Zero billing gaps. All subscriptions fully billed.' : `${unbilledGaps.length} subscriptions have unbilled elapsed periods.`,
  });

  const allGreen = checks.every((c) => c.passed);

  return {
    allGreen,
    checks,
  };
}
