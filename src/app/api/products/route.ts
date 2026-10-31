import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  const session = await getSession();
  const role = session?.role ?? 'customer';

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      productAttributes: {
        include: {
          attribute: {
            include: {
              values: true,
            },
          },
        },
      },
      productTaxes: {
        include: {
          tax: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Strip costPrice and compute margin for non-customer roles
  const formatted = products.map((p) => {
    const isCustomer = role === 'customer';
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      salesPrice: p.salesPrice.toString(),
      costPrice: isCustomer ? undefined : p.costPrice.toString(),
      margin: isCustomer ? undefined : (p.salesPrice - p.costPrice).toString(),
      notes: p.notes,
      isActive: p.isActive,
      taxes: p.productTaxes.map((pt) => ({
        id: pt.tax.id,
        name: pt.tax.name,
        rateBp: pt.tax.rateBp,
        type: pt.tax.type,
        priceIncluded: pt.tax.priceIncluded,
      })),
      attributes: p.productAttributes.map((pa) => ({
        id: pa.attribute.id,
        name: pa.attribute.name,
        values: pa.attribute.values.map((v) => ({
          id: v.id,
          label: v.label,
          extraPrice: v.extraPrice.toString(),
        })),
      })),
    };
  });

  return NextResponse.json({ products: formatted });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, 'products', 'create')) {
    return NextResponse.json({ error: 'FORBIDDEN: Admin role required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, type, salesPrice, costPrice, notes, taxIds, attributes } = body;

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name,
          type: type || 'software',
          salesPrice: BigInt(salesPrice || 0),
          costPrice: BigInt(costPrice || 0),
          notes,
          isActive: true,
        },
      });

      // Link taxes
      if (taxIds && Array.isArray(taxIds)) {
        for (const taxId of taxIds) {
          await tx.productTax.create({
            data: { productId: created.id, taxId },
          });
        }
      }

      // Create attributes and values if provided (e.g. Brand -> Odoo +560)
      if (attributes && Array.isArray(attributes)) {
        for (const attr of attributes) {
          const attribute = await tx.attribute.create({
            data: {
              name: attr.name,
              values: {
                create: (attr.values || []).map((val: any) => ({
                  label: val.label,
                  extraPrice: BigInt(val.extraPrice || 0),
                })),
              },
            },
          });

          await tx.productAttribute.create({
            data: { productId: created.id, attributeId: attribute.id },
          });
        }
      }

      return created;
    });

    return NextResponse.json({ success: true, product: { ...product, salesPrice: product.salesPrice.toString(), costPrice: product.costPrice.toString() } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
