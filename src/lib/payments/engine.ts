import prisma from '@/lib/db';
import { businessDate } from '@/lib/clock';
import { PaymentMethod } from '@prisma/client';
import { recordAuditLog } from '@/lib/audit';

export interface RecordPaymentParams {
  invoiceId: string;
  amount: bigint; // paise
  method: PaymentMethod;
  reference?: string;
  note?: string;
  idempotencyKey: string;
  recordedBy: string;
}

export interface DerivedInvoiceStatus {
  isOverdue: boolean;
  isPartiallyPaid: boolean;
  isOutstanding: boolean;
  agingBucket?: '1-7' | '8-30' | '31-60' | '60+' | null;
  daysPastDue?: number;
  balance: bigint;
}

/**
 * Compute derived status labels for an invoice (PRD Section 8)
 * Never stored in DB; dynamically evaluated based on facts.
 */
export function computeDerivedInvoiceStatus(
  status: string,
  total: bigint,
  amountPaid: bigint,
  dueDate: Date,
  today: Date
): DerivedInvoiceStatus {
  const balance = total - amountPaid;
  const isPaid = status === 'paid' || balance <= 0n;
  const isCancelled = status === 'cancelled';
  const isDraft = status === 'draft';

  if (isPaid || isCancelled || isDraft) {
    return {
      isOverdue: false,
      isPartiallyPaid: false,
      isOutstanding: false,
      agingBucket: null,
      daysPastDue: 0,
      balance,
    };
  }

  const isOutstanding = status === 'confirmed' && balance > 0n;
  const isPartiallyPaid = status === 'confirmed' && amountPaid > 0n && amountPaid < total;

  const dueTime = new Date(dueDate).setHours(0, 0, 0, 0);
  const todayTime = new Date(today).setHours(0, 0, 0, 0);
  const diffDays = Math.floor((todayTime - dueTime) / (1000 * 60 * 60 * 24));
  const isOverdue = status === 'confirmed' && balance > 0n && diffDays > 0;

  let agingBucket: '1-7' | '8-30' | '31-60' | '60+' | null = null;
  if (isOverdue) {
    if (diffDays <= 7) agingBucket = '1-7';
    else if (diffDays <= 30) agingBucket = '8-30';
    else if (diffDays <= 60) agingBucket = '31-60';
    else agingBucket = '60+';
  }

  return {
    isOverdue,
    isPartiallyPaid,
    isOutstanding,
    agingBucket,
    daysPastDue: isOverdue ? diffDays : 0,
    balance,
  };
}

/**
 * Record a payment against an invoice (PRD Section 8)
 */
export async function recordPayment(params: RecordPaymentParams) {
  const today = await businessDate();

  if (params.amount <= 0n) {
    throw new Error('Payment amount must be greater than zero');
  }

  return await prisma.$transaction(async (tx) => {
    // Check idempotency
    const existingPayment = await tx.payment.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existingPayment) {
      return { success: true, payment: existingPayment, isDuplicate: true };
    }

    const invoice = await tx.invoice.findUnique({
      where: { id: params.invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'draft') {
      throw new Error('Cannot record payment for a draft invoice');
    }
    if (invoice.status === 'cancelled') {
      throw new Error('Cannot record payment for a cancelled invoice');
    }

    const currentBalance = invoice.total - invoice.amountPaid;
    if (params.amount > currentBalance) {
      throw new Error(`Payment amount (₹${Number(params.amount) / 100}) exceeds invoice balance (₹${Number(currentBalance) / 100})`);
    }

    // Create payment
    const payment = await tx.payment.create({
      data: {
        invoiceId: params.invoiceId,
        method: params.method,
        amount: params.amount,
        paymentDate: today,
        reference: params.reference,
        note: params.note,
        idempotencyKey: params.idempotencyKey,
        recordedBy: params.recordedBy,
        status: 'recorded',
      },
    });

    // Update invoice amountPaid and status
    const newAmountPaid = invoice.amountPaid + params.amount;
    const isNowFullyPaid = newAmountPaid >= invoice.total;

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newAmountPaid,
        status: isNowFullyPaid ? 'paid' : invoice.status,
      },
    });

    // Audit log
    await recordAuditLog({
      actorId: params.recordedBy.startsWith('usr_') ? params.recordedBy : null,
      action: 'PAYMENT_RECORDED',
      entity: 'payment',
      entityId: payment.id,
      after: {
        amount: params.amount,
        method: params.method,
        invoiceId: invoice.id,
        isNowFullyPaid,
      },
    });

    return { success: true, payment, isDuplicate: false };
  });
}

/**
 * Void a payment (PRD Section 8)
 * History is preserved, status flipped to voided, invoice balance and status restored!
 */
export async function voidPayment(paymentId: string, voidReason: string, actorId: string) {
  return await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });

    if (!payment) throw new Error('Payment not found');
    if (payment.status === 'voided') throw new Error('Payment already voided');

    // Void the payment
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'voided',
        voidedAt: new Date(),
        voidReason,
      },
    });

    // Reduce amountPaid on invoice and reopen if needed
    const newAmountPaid = payment.invoice.amountPaid - payment.amount;
    const newStatus = newAmountPaid < payment.invoice.total ? 'confirmed' : 'paid';

    await tx.invoice.update({
      where: { id: payment.invoice.id },
      data: {
        amountPaid: newAmountPaid >= 0n ? newAmountPaid : 0n,
        status: newStatus,
      },
    });

    await recordAuditLog({
      actorId: actorId.startsWith('usr_') ? actorId : null,
      action: 'PAYMENT_VOIDED',
      entity: 'payment',
      entityId: payment.id,
      before: { status: 'recorded' },
      after: { status: 'voided', voidReason },
    });

    return { success: true };
  });
}
