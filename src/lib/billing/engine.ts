import prisma from '@/lib/db';
import { businessDate } from '@/lib/clock';
import { addBillingPeriod, BillingPeriod } from '@/lib/billing/calendar';
import { calculateInvoiceTotals, InputLineItem, TaxRule } from '@/lib/billing/tax';
import { resolveBestDiscounts, DiscountRule } from '@/lib/billing/discount';
import { getNextSequenceNumber } from '@/lib/numbering';
import { recordAuditLog } from '@/lib/audit';

export interface BillingRunOptions {
  triggeredBy: string;
  dryRun?: boolean;
  targetSubscriptionId?: string; // For manual single invoice generation
  maxCatchUpCycles?: number;     // Cap on overdue cycles (default 12)
}

export interface BillingRunSummary {
  runId: string;
  businessDate: Date;
  dryRun: boolean;
  createdCount: number;
  skipped: Array<{ subscriptionId: string; subscriptionNumber: string; reason: string }>;
  failed: Array<{ subscriptionId: string; subscriptionNumber: string; error: string }>;
  invoicesPreview?: Array<{
    subscriptionId: string;
    subscriptionNumber: string;
    customerName: string;
    periodStart: Date;
    periodEnd: Date;
    subtotal: bigint;
    discountTotal: bigint;
    taxTotal: bigint;
    total: bigint;
    willSkipReason?: string;
  }>;
}

/**
 * Execute the automated Billing Engine (PRD Section 7.2)
 * Idempotent, safe for concurrent workers, explainable, and supports dry-run preview.
 */
export async function executeBillingRun(options: BillingRunOptions): Promise<BillingRunSummary> {
  const today = await businessDate();
  const dryRun = !!options.dryRun;
  const maxCycles = options.maxCatchUpCycles ?? 12;

  // Create a record for this billing run (if not dry run)
  let runRecord = null;
  if (!dryRun) {
    runRecord = await prisma.billingRun.create({
      data: {
        businessDate: today,
        dryRun: false,
        triggeredBy: options.triggeredBy,
        createdCount: 0,
      },
    });
  }

  const summary: BillingRunSummary = {
    runId: runRecord?.id ?? `dry-run-${Date.now()}`,
    businessDate: today,
    dryRun,
    createdCount: 0,
    skipped: [],
    failed: [],
    invoicesPreview: [],
  };

  // Find active subscriptions that are due for billing
  const whereClause: any = {
    status: 'active',
    nextInvoiceDate: {
      lte: today,
    },
  };

  if (options.targetSubscriptionId) {
    whereClause.id = options.targetSubscriptionId;
  }

  const dueSubscriptions = await prisma.subscription.findMany({
    where: whereClause,
    include: {
      customer: true,
      plan: true,
      paymentTerm: true,
      lines: {
        include: {
          product: {
            include: {
              productTaxes: {
                include: {
                  tax: true,
                },
              },
            },
          },
          discount: true,
        },
      },
    },
    orderBy: [
      { nextInvoiceDate: 'asc' },
      { id: 'asc' },
    ],
  });

  // Pre-fetch all active discount rules
  const activeDiscounts = await prisma.discount.findMany({
    where: { isActive: true },
    include: {
      discountProducts: true,
    },
  });

  const discountRules: DiscountRule[] = activeDiscounts.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type as 'fixed' | 'percent',
    value: d.value,
    minPurchaseAmount: d.minPurchaseAmount,
    minQuantity: d.minQuantity,
    startDate: d.startDate,
    endDate: d.endDate,
    usageLimit: d.usageLimit,
    usedCount: d.usedCount,
    scope: d.scope as 'products' | 'subscription',
    stackable: d.stackable,
    isActive: d.isActive,
    productIds: d.discountProducts.map((dp) => dp.productId),
  }));

  for (const sub of dueSubscriptions) {
    try {
      // Check pause
      if (sub.pausedUntil && sub.nextInvoiceDate && sub.nextInvoiceDate <= sub.pausedUntil) {
        summary.skipped.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.number,
          reason: 'PAUSED',
        });
        continue;
      }

      // Check customer completeness (PRD Section 17 edge case)
      if (!sub.customer.billingAddress && !sub.customer.company) {
        summary.skipped.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.number,
          reason: 'CUSTOMER_INCOMPLETE',
        });
        continue;
      }

      // Catch-up cycle loop (bounded by maxCycles)
      let currentNextDate = new Date(sub.nextInvoiceDate!);
      let cyclesProcessed = 0;

      while (currentNextDate <= today && cyclesProcessed < maxCycles) {
        cyclesProcessed++;

        const periodStart = new Date(currentNextDate);
        const periodEnd = addBillingPeriod(
          periodStart,
          sub.plan.billingPeriod as BillingPeriod,
          sub.billingAnchorDay,
          1
        );

        // Check if period start is past expiry date
        if (sub.expiryDate && periodStart > sub.expiryDate) {
          summary.skipped.push({
            subscriptionId: sub.id,
            subscriptionNumber: sub.number,
            reason: 'PAST_EXPIRY',
          });
          break;
        }

        // Build line items from subscription snapshot lines
        const inputLines: InputLineItem[] = sub.lines.map((l) => {
          const taxes: TaxRule[] = l.product.productTaxes.map((pt) => ({
            id: pt.tax.id,
            name: pt.tax.name,
            rateBp: pt.tax.rateBp,
            type: pt.tax.type as 'percent' | 'fixed',
            priceIncluded: pt.tax.priceIncluded,
            gstComponent: pt.tax.gstComponent as any,
          }));

          return {
            id: l.id,
            productId: l.productId,
            description: `${l.product.name}${l.variantJson ? ` (${l.variantJson})` : ''}`,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxes,
          };
        });

        // Resolve eligible discounts for this period
        const discountableLines = inputLines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          grossAmount: l.unitPrice * BigInt(l.quantity),
        }));

        const bestDiscounts = resolveBestDiscounts(discountRules, periodStart, discountableLines);
        const subDiscountAmount = bestDiscounts
          .filter((d) => d.scope === 'subscription')
          .reduce((sum, d) => sum + d.amount, 0n);

        // Calculate final line amounts, taxes, and totals
        const calcResult = calculateInvoiceTotals(inputLines, subDiscountAmount);

        // Due date = invoice_date + term_days (default immediate = 0)
        const termDays = sub.paymentTerm?.days ?? 0;
        const dueDate = new Date(periodStart);
        dueDate.setDate(dueDate.getDate() + termDays);

        if (dryRun) {
          summary.invoicesPreview?.push({
            subscriptionId: sub.id,
            subscriptionNumber: sub.number,
            customerName: sub.customer.company || sub.customer.name,
            periodStart,
            periodEnd,
            subtotal: calcResult.subtotal,
            discountTotal: calcResult.discountTotal,
            taxTotal: calcResult.taxTotal,
            total: calcResult.total,
          });

          // Advance virtual next date for preview
          currentNextDate = periodEnd;
          continue;
        }

        // Real execution inside database transaction
        const invoiceCreated = await prisma.$transaction(async (tx) => {
          // Idempotency check: see if invoice already exists for (subscriptionId, periodStart, periodEnd)
          const existing = await tx.invoice.findFirst({
            where: {
              subscriptionId: sub.id,
              periodStart,
              periodEnd,
              status: { not: 'cancelled' },
              invoiceType: 'recurring',
            },
          });

          if (existing) {
            return { skipped: true, reason: 'ALREADY_BILLED' };
          }

          // Generate gapless sequence number for invoice
          const invoiceNumber = await getNextSequenceNumber('INV');

          // If total is 0 (e.g. 100% discount), mark auto-paid
          const initialStatus = calcResult.total === 0n ? 'paid' : 'confirmed';

          const inv = await tx.invoice.create({
            data: {
              number: invoiceNumber,
              subscriptionId: sub.id,
              customerId: sub.customerId,
              invoiceType: 'recurring',
              status: initialStatus,
              invoiceDate: periodStart,
              dueDate,
              periodStart,
              periodEnd,
              subtotal: calcResult.subtotal,
              discountTotal: calcResult.discountTotal,
              taxTotal: calcResult.taxTotal,
              total: calcResult.total,
              amountPaid: calcResult.total === 0n ? 0n : 0n,
              createdBy: options.triggeredBy,
              billingRunId: runRecord?.id,
              lines: {
                create: calcResult.lines.map((cl) => ({
                  productId: cl.productId,
                  description: cl.description,
                  quantity: cl.quantity,
                  unitPrice: cl.unitPrice,
                  discountAmount: cl.discountAmount,
                  taxAmount: cl.taxAmount,
                  amount: cl.totalAmount,
                  explainJson: JSON.stringify(cl.explain),
                })),
              },
            },
          });

          // Record discount redemptions and increment used_count atomically
          for (const d of bestDiscounts) {
            const updated = await tx.discount.updateMany({
              where: {
                id: d.discountId,
                usedCount: { lt: prisma.discount.fields.usageLimit },
              },
              data: {
                usedCount: { increment: 1 },
              },
            });

            if (updated.count > 0) {
              await tx.discountRedemption.create({
                data: {
                  discountId: d.discountId,
                  invoiceId: inv.id,
                  amount: d.amount,
                },
              });
            }
          }

          // Advance subscription's nextInvoiceDate to periodEnd
          await tx.subscription.update({
            where: { id: sub.id },
            data: {
              nextInvoiceDate: periodEnd,
            },
          });

          return { skipped: false, invoiceId: inv.id };
        });

        if (invoiceCreated.skipped) {
          summary.skipped.push({
            subscriptionId: sub.id,
            subscriptionNumber: sub.number,
            reason: invoiceCreated.reason || 'ALREADY_BILLED',
          });
          // Stop catch-up loop if already billed
          break;
        } else {
          summary.createdCount++;
          currentNextDate = periodEnd;
        }
      }
    } catch (err: any) {
      summary.failed.push({
        subscriptionId: sub.id,
        subscriptionNumber: sub.number,
        error: err?.message || String(err),
      });
    }
  }

  // Update billing run record if real run
  if (runRecord) {
    await prisma.billingRun.update({
      where: { id: runRecord.id },
      data: {
        finishedAt: new Date(),
        createdCount: summary.createdCount,
        skippedJson: JSON.stringify(summary.skipped),
        failedJson: JSON.stringify(summary.failed),
      },
    });

    await recordAuditLog({
      actorId: options.triggeredBy.startsWith('usr_') ? options.triggeredBy : null,
      action: 'BILLING_RUN_COMPLETED',
      entity: 'billing_run',
      entityId: runRecord.id,
      after: {
        createdCount: summary.createdCount,
        skippedCount: summary.skipped.length,
        failedCount: summary.failed.length,
      },
    });
  }

  return summary;
}
