import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(p: string) {
  return bcrypt.hash(p, 12);
}

async function main() {
  console.log('Seeding Loopbook database...');

  // Clean existing tables in proper order
  await prisma.discountRedemption.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.mrrEvent.deleteMany();
  await prisma.subscriptionEvent.deleteMany();
  await prisma.subscriptionLine.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.quotationTemplateLine.deleteMany();
  await prisma.quotationTemplate.deleteMany();
  await prisma.planDefaultLine.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.discountProduct.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.productTax.deleteMany();
  await prisma.productAttribute.deleteMany();
  await prisma.attributeValue.deleteMany();
  await prisma.attribute.deleteMany();
  await prisma.tax.deleteMany();
  await prisma.product.deleteMany();
  await prisma.paymentTerm.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.passwordToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.numberSequence.deleteMany();
  await prisma.systemClock.deleteMany();

  // 1. Initialize Virtual Clock
  await prisma.systemClock.create({
    data: {
      id: 'singleton',
      offsetDays: 0,
    },
  });

  // 2. Users: Admin and Staff
  const adminPasswordHash = await hashPassword('Admin@123!');
  const staffPasswordHash = await hashPassword('Staff@123!');

  const admin = await prisma.user.create({
    data: {
      name: 'Brightloop Admin',
      emailNorm: 'admin@brightloop.in',
      passwordHash: adminPasswordHash,
      role: 'admin',
    },
  });

  const staff1 = await prisma.user.create({
    data: {
      name: 'Rahul Sharma (Ops Lead)',
      emailNorm: 'rahul@brightloop.in',
      passwordHash: staffPasswordHash,
      role: 'staff',
    },
  });

  const staff2 = await prisma.user.create({
    data: {
      name: 'Priya Patel (Billing Specialist)',
      emailNorm: 'priya@brightloop.in',
      passwordHash: staffPasswordHash,
      role: 'staff',
    },
  });

  const staff3 = await prisma.user.create({
    data: {
      name: 'Vikram Mehta (Customer Success)',
      emailNorm: 'vikram@brightloop.in',
      passwordHash: staffPasswordHash,
      role: 'staff',
    },
  });

  // Story Customer: Sunita - Anand Bhavan Hotels
  const customerPasswordHash = await hashPassword('Customer@123!');
  const sunitaUser = await prisma.user.create({
    data: {
      name: 'Sunita Rao',
      emailNorm: 'sunita@anandbhavan.com',
      passwordHash: customerPasswordHash,
      role: 'customer',
    },
  });

  const anandBhavan = await prisma.customer.create({
    data: {
      userId: sunitaUser.id,
      name: 'Sunita Rao',
      company: 'Hotel Anand Bhavan Group',
      billingAddress: '42 MG Road, Bengaluru, Karnataka 560001',
      state: 'Karnataka',
      taxId: '29ABCDE1234F1Z5',
      phone: '+91 98450 12345',
    },
  });

  // Additional Story Customers
  const customer2 = await prisma.customer.create({
    data: {
      name: 'Karthik Menon',
      company: 'Menon Logistics & Cold Chain',
      billingAddress: '15 Marine Drive, Kochi, Kerala 682011',
      state: 'Kerala',
      taxId: '32AABCM5678K1Z9',
      phone: '+91 94470 67890',
    },
  });

  const customer3 = await prisma.customer.create({
    data: {
      name: 'Ananya Deshmukh',
      company: 'Apex Diagnostics & Labs',
      billingAddress: '102 Senapati Bapat Marg, Pune, Maharashtra 411016',
      state: 'Maharashtra',
      taxId: '27AABCA9012P1Z3',
      phone: '+91 98220 34567',
    },
  });

  // 3. Payment Terms
  const termImmediate = await prisma.paymentTerm.create({
    data: { name: 'Immediate', days: 0 },
  });
  const termNet15 = await prisma.paymentTerm.create({
    data: { name: 'Net 15', days: 15 },
  });
  const termNet30 = await prisma.paymentTerm.create({
    data: { name: 'Net 30', days: 30 },
  });

  // 4. Taxes (PRD Section 7.4)
  const gst18 = await prisma.tax.create({
    data: { name: 'GST 18%', rateBp: 1800, type: 'percent', priceIncluded: false, gstComponent: 'igst' },
  });
  const gst12 = await prisma.tax.create({
    data: { name: 'GST 12%', rateBp: 1200, type: 'percent', priceIncluded: false, gstComponent: 'igst' },
  });
  const gst5 = await prisma.tax.create({
    data: { name: 'GST 5%', rateBp: 500, type: 'percent', priceIncluded: false, gstComponent: 'igst' },
  });
  const gst18Incl = await prisma.tax.create({
    data: { name: 'GST 18% (Inclusive)', rateBp: 1800, type: 'percent', priceIncluded: true },
  });
  const envCess = await prisma.tax.create({
    data: { name: 'Green Cloud Cess', rateBp: 1000, type: 'fixed', priceIncluded: false }, // ₹10 fixed
  });

  // 5. Products & Variants (PRD Section 5: Base 1,000 + Brand: Odoo +560 = 1,560)
  const attrBrand = await prisma.attribute.create({
    data: {
      name: 'Brand Integration',
      values: {
        create: [
          { label: 'Odoo (+560)', extraPrice: 56000n }, // +₹560.00
          { label: 'Zoho (+0)', extraPrice: 0n },
          { label: 'Tally (+350)', extraPrice: 35000n },
        ],
      },
    },
  });

  const pSoftwareSeat = await prisma.product.create({
    data: {
      name: 'Brightloop Core Seat',
      type: 'software',
      salesPrice: 100000n, // ₹1,000.00
      costPrice: 40000n,   // ₹400.00 (margin = ₹600)
      notes: 'Per-user recurring SaaS seat license',
      productTaxes: { create: [{ taxId: gst18.id }] },
      productAttributes: { create: [{ attributeId: attrBrand.id }] },
    },
  });

  const pStorageAddon = await prisma.product.create({
    data: {
      name: '100GB Secure Cloud Storage',
      type: 'addon',
      salesPrice: 49900n, // ₹499.00
      costPrice: 12000n,  // ₹120.00
      notes: 'Monthly add-on storage bucket',
      productTaxes: { create: [{ taxId: gst18.id }] },
    },
  });

  const pAuditService = await prisma.product.create({
    data: {
      name: 'Quarterly Compliance Audit',
      type: 'service',
      salesPrice: 1500000n, // ₹15,000.00
      costPrice: 600000n,   // ₹6,000.00
      notes: 'Professional human compliance verification',
      productTaxes: { create: [{ taxId: gst18.id }] },
    },
  });

  const pHardwareKey = await prisma.product.create({
    data: {
      name: 'Hardware Security Key (FIDO2)',
      type: 'physical',
      salesPrice: 250000n, // ₹2,500.00
      costPrice: 140000n,  // ₹1,400.00
      notes: 'Physical token device',
      productTaxes: { create: [{ taxId: gst18.id }] },
    },
  });

  // 6. Plans with D14 Flags (PRD Section 5)
  const planMonthlyGrowth = await prisma.plan.create({
    data: {
      name: 'Growth Monthly (Standard)',
      price: 100000n,
      billingPeriod: 'monthly',
      minQuantity: 5,
      autoCloseOnEnd: false,
      allowEarlyClose: true,
      allowPause: true,
      allowRenew: true,
    },
  });

  const planYearlyEnterprise = await prisma.plan.create({
    data: {
      name: 'Enterprise Yearly (No Pause)',
      price: 1000000n, // ₹10,000 / seat / year
      billingPeriod: 'yearly',
      minQuantity: 10,
      autoCloseOnEnd: false,
      allowEarlyClose: false, // early close disallowed
      allowPause: false,      // pause disallowed
      allowRenew: true,
    },
  });

  const planProjectQuarterly = await prisma.plan.create({
    data: {
      name: 'Fixed Contract (Auto-Close)',
      price: 300000n,
      billingPeriod: 'monthly',
      minQuantity: 1,
      autoCloseOnEnd: true,  // closes automatically
      allowEarlyClose: true,
      allowPause: false,
      allowRenew: false,
    },
  });

  // 7. Quotation Templates (PRD Section 6)
  const templateGrowth = await prisma.quotationTemplate.create({
    data: {
      name: 'Standard 25-Seat Growth Template',
      validityDays: 15,
      planId: planMonthlyGrowth.id,
      lines: {
        create: [
          {
            productId: pSoftwareSeat.id,
            qty: 25,
            variantJson: '{"Brand Integration":"Odoo (+560)"}',
          },
          {
            productId: pStorageAddon.id,
            qty: 2,
          },
        ],
      },
    },
  });

  // 8. Discounts (PRD Section 7.5 & Section 14)
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const expIn3Days = new Date(now);
  expIn3Days.setDate(expIn3Days.getDate() + 3);

  // Story discount: 10% on >= 10 seats, limit 3 uses
  const disc10Seats = await prisma.discount.create({
    data: {
      name: '10% Multi-Seat Advantage',
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
    },
  });

  // Discount nearly exhausted (2 of 3 used)
  const discNearlyExhausted = await prisma.discount.create({
    data: {
      name: 'Early Adopter ₹2,000 Flat',
      type: 'fixed',
      value: 200000n, // ₹2,000.00
      minPurchaseAmount: 500000n,
      minQuantity: 1,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      usageLimit: 3,
      usedCount: 2, // 1 use left!
      scope: 'subscription',
      stackable: false,
    },
  });

  // Discount expiring in 3 days
  const discExpiringSoon = await prisma.discount.create({
    data: {
      name: 'Flash Festival Promo (3 Days Left)',
      type: 'percent',
      value: 1500n, // 15%
      minPurchaseAmount: 0n,
      minQuantity: 1,
      startDate: new Date('2026-01-01'),
      endDate: expIn3Days,
      usageLimit: 50,
      usedCount: 12,
      scope: 'subscription',
      stackable: false,
    },
  });

  // 9. Create Story Subscriptions across all states (Draft, Quotation, Confirmed, Active, Closed)
  // Sub 1: Hotel Anand Bhavan - 25 seats with Odoo variant (+560 -> 1,560)
  const subAnandBhavan = await prisma.subscription.create({
    data: {
      number: 'SUB/2026/000001',
      customerId: anandBhavan.id,
      planId: planMonthlyGrowth.id,
      status: 'active',
      startDate: new Date('2026-01-01'),
      expiryDate: new Date('2026-12-31'),
      paymentTermId: termNet15.id,
      billingAnchorDay: 1,
      nextInvoiceDate: new Date('2026-03-01'),
      autoRenew: true,
      notes: 'Flagship hospitality customer with 25 Odoo-connected terminals',
      createdBy: admin.id,
      lines: {
        create: [
          {
            productId: pSoftwareSeat.id,
            variantJson: '{"Brand Integration":"Odoo (+560)"}',
            quantity: 25,
            unitPrice: 156000n, // snapshot: ₹1,560.00
            discountId: disc10Seats.id,
          },
          {
            productId: pStorageAddon.id,
            quantity: 2,
            unitPrice: 49900n, // snapshot: ₹499.00
          },
        ],
      },
    },
  });

  // Write initial events & MRR for Anand Bhavan
  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId: subAnandBhavan.id,
      type: 'activated',
      toStatus: 'active',
      actor: admin.id,
      reason: 'Onboarded on Jan 1',
    },
  });

  await prisma.mrrEvent.create({
    data: {
      subscriptionId: subAnandBhavan.id,
      type: 'new_sub',
      deltaMrr: 156000n * 25n + 49900n * 2n,
      at: new Date('2026-01-01'),
    },
  });

  // Create Jan & Feb invoices for Anand Bhavan
  const invJan = await prisma.invoice.create({
    data: {
      number: 'INV/2026/000001',
      subscriptionId: subAnandBhavan.id,
      customerId: anandBhavan.id,
      status: 'paid',
      invoiceDate: new Date('2026-01-01'),
      dueDate: new Date('2026-01-16'),
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-02-01'),
      subtotal: 3999800n, // (25 * 1560) + (2 * 499) = 39,000 + 998 = ₹39,998
      discountTotal: 399980n, // 10% = ₹3,999.80
      taxTotal: 647968n,     // 18% GST on net
      total: 4247788n,       // ₹42,477.88
      amountPaid: 4247788n,  // Fully paid
      lines: {
        create: [
          {
            productId: pSoftwareSeat.id,
            description: 'Brightloop Core Seat (Brand Integration: Odoo (+560))',
            quantity: 25,
            unitPrice: 156000n,
            discountAmount: 390000n,
            taxAmount: 631800n,
            amount: 4141800n,
            explainJson: JSON.stringify({
              baseUnitPrice: '1000.00',
              variantAddon: '560.00',
              effectiveUnitPrice: '1560.00',
              quantity: 25,
              grossAmount: '39000.00',
              discount: '3900.00 (10% Multi-Seat)',
              net: '35100.00',
              tax: '6318.00 (18% GST)',
              finalTotal: '41418.00',
            }),
          },
        ],
      },
    },
  });

  // Jan Payment
  await prisma.payment.create({
    data: {
      invoiceId: invJan.id,
      method: 'bank_transfer',
      amount: 4247788n,
      paymentDate: new Date('2026-01-10'),
      reference: 'NEFT/HDFC/20260110/9871',
      idempotencyKey: 'pay_init_jan_anand',
      recordedBy: staff1.id,
      status: 'recorded',
    },
  });

  // Feb Invoice - Partially paid (for demo scene 6!)
  const invFeb = await prisma.invoice.create({
    data: {
      number: 'INV/2026/000002',
      subscriptionId: subAnandBhavan.id,
      customerId: anandBhavan.id,
      status: 'confirmed',
      invoiceDate: new Date('2026-02-01'),
      dueDate: new Date('2026-02-16'),
      periodStart: new Date('2026-02-01'),
      periodEnd: new Date('2026-03-01'),
      subtotal: 3999800n,
      discountTotal: 399980n,
      taxTotal: 647968n,
      total: 4247788n,
      amountPaid: 2000000n, // ₹20,000 paid out of ₹42,477.88
      lines: {
        create: [
          {
            productId: pSoftwareSeat.id,
            description: 'Brightloop Core Seat (Brand Integration: Odoo (+560))',
            quantity: 25,
            unitPrice: 156000n,
            discountAmount: 390000n,
            taxAmount: 631800n,
            amount: 4141800n,
            explainJson: JSON.stringify({
              baseUnitPrice: '1000.00',
              variantAddon: '560.00',
              effectiveUnitPrice: '1560.00',
              quantity: 25,
              grossAmount: '39000.00',
              discount: '3900.00 (10% Multi-Seat)',
              net: '35100.00',
              tax: '6318.00 (18% GST)',
              finalTotal: '41418.00',
            }),
          },
        ],
      },
    },
  });

  // Partial Payment (UPI) for Feb
  await prisma.payment.create({
    data: {
      invoiceId: invFeb.id,
      method: 'upi',
      amount: 2000000n, // ₹20,000
      paymentDate: new Date('2026-02-05'),
      reference: 'UPI/20260205/654321',
      note: 'Part 1 payment via UPI',
      idempotencyKey: 'pay_feb_part1_upi',
      recordedBy: staff2.id,
      status: 'recorded',
    },
  });

  // Overdue Invoice for Customer 2 (Menon Logistics)
  const subMenon = await prisma.subscription.create({
    data: {
      number: 'SUB/2026/000002',
      customerId: customer2.id,
      planId: planMonthlyGrowth.id,
      status: 'active',
      startDate: new Date('2025-11-01'),
      expiryDate: new Date('2026-11-01'),
      paymentTermId: termNet15.id,
      billingAnchorDay: 1,
      nextInvoiceDate: new Date('2026-02-01'),
      createdBy: admin.id,
      lines: {
        create: [
          {
            productId: pSoftwareSeat.id,
            quantity: 12,
            unitPrice: 100000n, // Zoho: ₹1,000.00
          },
        ],
      },
    },
  });

  const invMenonOverdue = await prisma.invoice.create({
    data: {
      number: 'INV/2025/000099',
      subscriptionId: subMenon.id,
      customerId: customer2.id,
      status: 'confirmed',
      invoiceDate: new Date('2025-12-01'),
      dueDate: new Date('2025-12-16'), // Past due! (Overdue)
      periodStart: new Date('2025-12-01'),
      periodEnd: new Date('2026-01-01'),
      subtotal: 1200000n,
      discountTotal: 0n,
      taxTotal: 216000n,
      total: 1416000n, // ₹14,160.00
      amountPaid: 0n,   // 0 paid -> Overdue AR!
      lines: {
        create: [
          {
            productId: pSoftwareSeat.id,
            description: 'Brightloop Core Seat (Standard)',
            quantity: 12,
            unitPrice: 100000n,
            discountAmount: 0n,
            taxAmount: 216000n,
            amount: 1416000n,
          },
        ],
      },
    },
  });

  // Quotation State Subscription for Customer 3
  await prisma.subscription.create({
    data: {
      number: 'SUB/2026/000003',
      customerId: customer3.id,
      planId: planYearlyEnterprise.id,
      status: 'quotation',
      startDate: new Date('2026-04-01'),
      expiryDate: new Date('2027-04-01'),
      paymentTermId: termNet30.id,
      billingAnchorDay: 1,
      quotationExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      notes: 'Enterprise 50-seat quote awaiting board signoff',
      createdBy: staff1.id,
      lines: {
        create: [
          {
            productId: pSoftwareSeat.id,
            quantity: 50,
            unitPrice: 1000000n, // ₹10,000 yearly
          },
        ],
      },
    },
  });

  // Draft State Subscription
  await prisma.subscription.create({
    data: {
      number: 'SUB/2026/000004',
      customerId: customer3.id,
      planId: planMonthlyGrowth.id,
      status: 'draft',
      startDate: new Date('2026-05-01'),
      billingAnchorDay: 1,
      notes: 'New draft quote being prepared',
      createdBy: staff2.id,
      lines: {
        create: [
          {
            productId: pSoftwareSeat.id,
            quantity: 5,
            unitPrice: 100000n,
          },
        ],
      },
    },
  });

  // Seed Number Sequences
  await prisma.numberSequence.createMany({
    data: [
      { prefix: 'SUB', year: 2026, lastValue: 4 },
      { prefix: 'INV', year: 2026, lastValue: 2 },
      { prefix: 'INV', year: 2025, lastValue: 99 },
    ],
  });

  console.log('Seed completed successfully!');
  console.log('Admin login: admin@brightloop.in / Admin@123!');
  console.log('Staff login: rahul@brightloop.in / Staff@123!');
  console.log('Customer portal login: sunita@anandbhavan.com / Customer@123!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
