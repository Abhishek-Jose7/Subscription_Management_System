import prisma from '@/lib/db';
import { businessDate } from '@/lib/clock';
import { SubscriptionStatus, MrrEventType } from '@prisma/client';
import { recordAuditLog } from '@/lib/audit';
import { getNextSequenceNumber } from '@/lib/numbering';
import { executeBillingRun } from '@/lib/billing/engine';

export interface StateTransitionResult {
  success: boolean;
  fromStatus: SubscriptionStatus;
  toStatus: SubscriptionStatus;
  error?: string;
  allowedTransitions?: SubscriptionStatus[];
}

// Allowed state transitions lookup
const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  draft: ['quotation', 'closed'],
  quotation: ['confirmed', 'closed'],
  confirmed: ['active', 'closed'],
  active: ['closed'],
  closed: [], // renewals create a new subscription with renewedFromId
};

/**
 * Validate and execute a subscription state transition (PRD Section 6)
 */
export async function transitionSubscriptionState(
  subscriptionId: string,
  targetStatus: SubscriptionStatus,
  actorId: string,
  reason?: string
): Promise<StateTransitionResult> {
  const today = await businessDate();

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      customer: true,
      plan: true,
      lines: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!sub) {
    throw new Error('Subscription not found');
  }

  const currentStatus = sub.status;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(targetStatus)) {
    return {
      success: false,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      error: `INVALID_TRANSITION: Cannot transition from ${currentStatus} to ${targetStatus}`,
      allowedTransitions: allowed,
    };
  }

  // Guard validations
  if (currentStatus === 'draft' && targetStatus === 'quotation') {
    if (sub.lines.length === 0) {
      return {
        success: false,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        error: 'CANNOT_SEND_QUOTE_WITHOUT_LINES',
        allowedTransitions: allowed,
      };
    }
    const totalQty = sub.lines.reduce((s, l) => s + l.quantity, 0);
    if (totalQty < sub.plan.minQuantity) {
      return {
        success: false,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        error: `QUANTITY_BELOW_PLAN_MINIMUM: Plan requires minimum ${sub.plan.minQuantity} units`,
        allowedTransitions: allowed,
      };
    }
  }

  if (currentStatus === 'quotation' && targetStatus === 'confirmed') {
    if (sub.quotationExpiresAt && sub.quotationExpiresAt < today) {
      return {
        success: false,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        error: 'QUOTATION_EXPIRED: Re-issue quotation before confirmation',
        allowedTransitions: allowed,
      };
    }
  }

  if (currentStatus === 'active' && targetStatus === 'closed') {
    if (!reason) {
      return {
        success: false,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        error: 'CLOSE_REASON_REQUIRED: A reason must be provided to close an active subscription',
        allowedTransitions: allowed,
      };
    }
    // Check if early close is disallowed by plan
    if (sub.expiryDate && today < sub.expiryDate && !sub.plan.allowEarlyClose) {
      return {
        success: false,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        error: 'PLAN_DISALLOWS_EARLY_CLOSE: Plan configuration prohibits early cancellation',
        allowedTransitions: allowed,
      };
    }
  }

  // Execute transition in transaction
  await prisma.$transaction(async (tx) => {
    const updateData: any = {
      status: targetStatus,
    };

    if (targetStatus === 'quotation') {
      // Set quotation expiration date (default 15 days if not set)
      const quoteExpiry = new Date(today);
      quoteExpiry.setDate(quoteExpiry.getDate() + 15);
      updateData.quotationExpiresAt = quoteExpiry;
    }

    if (targetStatus === 'confirmed') {
      // If start_date <= today, anchor and set next invoice date
      const anchorDay = sub.startDate.getDate();
      updateData.billingAnchorDay = anchorDay;
      updateData.nextInvoiceDate = sub.startDate;
    }

    if (targetStatus === 'closed') {
      updateData.closeReason = reason ?? 'User requested';
    }

    await tx.subscription.update({
      where: { id: sub.id },
      data: updateData,
    });

    // Record subscription event
    await tx.subscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: `transition_${targetStatus}`,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        actor: actorId,
        reason: reason ?? null,
      },
    });

    // Write audit log
    await recordAuditLog({
      actorId: actorId.startsWith('usr_') ? actorId : null,
      action: `SUBSCRIPTION_STATE_${targetStatus.toUpperCase()}`,
      entity: 'subscription',
      entityId: sub.id,
      before: { status: currentStatus },
      after: { status: targetStatus, reason },
    });

    // Record MRR movement event
    if (targetStatus === 'active') {
      // Calculate normalized monthly recurring revenue
      const monthlyAmount = calculateNormalizedMonthlyPaise(sub.lines, sub.plan.billingPeriod);
      await tx.mrrEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'new_sub',
          deltaMrr: monthlyAmount,
          at: today,
        },
      });
    } else if (targetStatus === 'closed' && currentStatus === 'active') {
      const monthlyAmount = calculateNormalizedMonthlyPaise(sub.lines, sub.plan.billingPeriod);
      await tx.mrrEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'churn',
          deltaMrr: -monthlyAmount,
          at: today,
        },
      });
    }
  });

  // If transitioning to Confirmed and startDate <= today, automatically activate!
  if (targetStatus === 'confirmed' && sub.startDate <= today) {
    await transitionSubscriptionState(subscriptionId, 'active', 'system', 'Start date reached upon confirmation');
    // Generate first invoice immediately in advance
    await executeBillingRun({
      triggeredBy: 'system_activation',
      targetSubscriptionId: subscriptionId,
    });
  }

  return {
    success: true,
    fromStatus: currentStatus,
    toStatus: targetStatus,
    allowedTransitions: ALLOWED_TRANSITIONS[targetStatus],
  };
}

/** Normalize subscription revenue to monthly paise (PRD Section 10) */
export function calculateNormalizedMonthlyPaise(lines: Array<{ unitPrice: bigint; quantity: number }>, period: string): bigint {
  const recurringGross = lines.reduce((s, l) => s + l.unitPrice * BigInt(l.quantity), 0n);
  if (period === 'monthly') return recurringGross;
  if (period === 'yearly') return recurringGross / 12n;
  if (period === 'weekly') return (recurringGross * 52n) / 12n;
  if (period === 'daily') return (recurringGross * 365n) / 12n;
  return recurringGross;
}

/**
 * Renew an existing subscription (PRD Section 6)
 * Creates a brand new linked subscription preserving history
 */
export async function renewSubscription(
  subscriptionId: string,
  actorId: string
): Promise<{ success: boolean; newSubscriptionId?: string; error?: string }> {
  const today = await businessDate();

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      lines: true,
    },
  });

  if (!sub) return { success: false, error: 'Subscription not found' };
  if (!sub.plan.allowRenew) return { success: false, error: 'PLAN_DISALLOWS_RENEW' };

  const newNumber = await getNextSequenceNumber('SUB');

  // Compute new start and expiry dates
  const newStartDate = sub.expiryDate ? new Date(sub.expiryDate) : today;
  let newExpiryDate: Date | null = null;
  if (sub.plan.billingPeriod === 'monthly') {
    newExpiryDate = new Date(newStartDate);
    newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
  } else if (sub.plan.billingPeriod === 'yearly') {
    newExpiryDate = new Date(newStartDate);
    newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
  }

  const newSub = await prisma.$transaction(async (tx) => {
    const created = await tx.subscription.create({
      data: {
        number: newNumber,
        customerId: sub.customerId,
        planId: sub.planId,
        status: 'draft',
        startDate: newStartDate,
        expiryDate: newExpiryDate,
        paymentTermId: sub.paymentTermId,
        billingAnchorDay: newStartDate.getDate(),
        autoRenew: sub.autoRenew,
        renewedFromId: sub.id,
        notes: `Renewed from ${sub.number}`,
        createdBy: actorId,
        lines: {
          create: sub.lines.map((l) => ({
            productId: l.productId,
            variantJson: l.variantJson,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxSnapshotJson: l.taxSnapshotJson,
            discountId: l.discountId,
          })),
        },
      },
    });

    await tx.subscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'renewed_into_new_subscription',
        actor: actorId,
        payloadJson: JSON.stringify({ newSubscriptionId: created.id, newNumber: created.number }),
      },
    });

    return created;
  });

  return { success: true, newSubscriptionId: newSub.id };
}
