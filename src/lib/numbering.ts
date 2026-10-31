import prisma from '@/lib/db';
import { businessDate } from '@/lib/clock';

/**
 * Generate gapless sequence numbers (PRD Decision D19)
 * Format: [PREFIX]/[YEAR]/[000001]
 * Gapless sequence assigned at confirmation (not at draft) for invoices.
 * Subscriptions assigned on creation.
 */
export async function getNextSequenceNumber(prefix: 'SUB' | 'INV'): Promise<string> {
  const now = await businessDate();
  const year = now.getFullYear();

  // Atomically increment the sequence counter
  const result = await prisma.$transaction(async (tx) => {
    const seq = await tx.numberSequence.upsert({
      where: {
        prefix_year: {
          prefix,
          year,
        },
      },
      update: {
        lastValue: {
          increment: 1,
        },
      },
      create: {
        prefix,
        year,
        lastValue: 1,
      },
    });

    const paddedNumber = seq.lastValue.toString().padStart(6, '0');
    return `${prefix}/${year}/${paddedNumber}`;
  });

  return result;
}
